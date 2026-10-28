import { Router } from 'express';
import pool from '../db.js';
import { authenticate, authorizeSelfOrRoles } from '../services/auth.js';
import { buildGatewayPayload, chargeCard, PaymentGatewayError } from '../services/paymentGateway.js';
import { notifyOrderStatus } from '../services/orderEmails.js';

const router = Router();

// ── Checkout / Pagos ─────────────────────────────────────────────────────────
const ensurePaymentsTable = () => pool.query(`
  CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'GTQ',
    status VARCHAR(20) NOT NULL,
    gateway_reference VARCHAR(100),
    auth_code VARCHAR(20),
    card_brand VARCHAR(20),
    card_last4 VARCHAR(4),
    decline_code VARCHAR(50),
    decline_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

const savePaymentRecord = async ({ orderId, userId, amount, status, gatewayResult }) => {
  await ensurePaymentsTable();
  const result = await pool.query(
    `INSERT INTO payments
       (order_id, user_id, amount, status, gateway_reference, auth_code, card_brand, card_last4, decline_code, decline_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, order_id, status, card_brand, card_last4, created_at`,
    [
      orderId,
      userId,
      amount,
      status,
      gatewayResult.transactionId,
      gatewayResult.authCode,
      gatewayResult.brand,
      gatewayResult.last4,
      gatewayResult.declineCode,
      gatewayResult.declineMessage,
    ]
  );
  return result.rows[0];
};

const CARD_FIELDS = ["cardholderName", "cardNumber", "expiryMonth", "expiryYear", "cvv", "billingAddress", "city", "postalCode", "country"];

function validateCardPayload(body) {
  for (const field of CARD_FIELDS) {
    if (!body?.[field] || !String(body[field]).trim()) {
      return `El campo '${field}' es requerido para procesar el pago.`;
    }
  }
  const digits = String(body.cardNumber).replace(/\D/g, "");
  if (digits.length !== 16) return "El número de tarjeta debe tener 16 dígitos.";
  if (!/^\d{3}$/.test(body.cvv)) return "El CVV debe tener exactamente 3 dígitos.";
  return null;
}

// SFTWRKEY-295: Crear endpoint para pagos
// SFTWRKEY-296: Enviar información del carrito (a la pasarela)
// SFTWRKEY-297: Procesar respuesta de la pasarela
// SFTWRKEY-298: Mostrar confirmación de compra (datos que consume el frontend)
// SFTWRKEY-299: Registrar pago en base de datos
// SFTWRKEY-300: Manejo de pagos rechazados
router.post("/checkout/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  const { userId } = req.params;
  const cardPayload = req.body ?? {};

  const validationError = validateCardPayload(cardPayload);
  if (validationError) {
    return res.status(400).json({ success: false, code: "INVALID_PAYMENT_DATA", message: validationError });
  }

  const client = await pool.connect();

  try {
    await ensurePaymentsTable();
    const cartResult = await client.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) {
      return res.status(400).json({ success: false, code: "EMPTY_CART", message: "Tu carrito está vacío." });
    }
    const cartId = cartResult.rows[0].id;

    const itemsResult = await client.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    if (itemsResult.rows.length === 0) {
      return res.status(400).json({ success: false, code: "EMPTY_CART", message: "Tu carrito está vacío." });
    }

    const sinStock = itemsResult.rows.filter(item => item.quantity > item.stock);
    if (sinStock.length > 0) {
      return res.status(409).json({
        success: false,
        code: "INSUFFICIENT_STOCK",
        message: "Algunos productos ya no tienen stock suficiente.",
        items: sinStock.map(i => ({ product_id: i.product_id, name: i.name, disponible: i.stock, solicitado: i.quantity }))
      });
    }

    const total = itemsResult.rows.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    // Recalculado a partir de p.price en la consulta anterior: el monto nunca se confía del cliente.

    // SFTWRKEY-296: se arma el payload con el detalle del carrito y se envía a la pasarela
    const gatewayPayload = buildGatewayPayload({
      orderReference: `user-${userId}-${Date.now()}`,
      amount: total,
      cartItems: itemsResult.rows,
      card: cardPayload,
      billing: cardPayload,
    });

    // SFTWRKEY-297: se procesa la respuesta de la pasarela (aprobado o rechazado)
    const gatewayResult = await chargeCard(gatewayPayload);

    if (!gatewayResult.approved) {
      // SFTWRKEY-300: manejo de pagos rechazados — se registra el intento fallido
      // (sin crear orden ni tocar el stock) y se informa el motivo al frontend.
      const payment = await savePaymentRecord({
        orderId: null,
        userId,
        amount: total,
        status: "rechazado",
        gatewayResult,
      });
      return res.status(402).json({
        success: false,
        code: "CARD_DECLINED",
        message: gatewayResult.declineMessage,
        declineCode: gatewayResult.declineCode,
        payment: { id: payment.id, status: payment.status },
      });
    }

    await client.query('BEGIN');

    // Se vuelve a verificar y bloquear el stock dentro de la transacción para evitar
    // que dos checkouts concurrentes sobrevendan el mismo producto.
    for (const item of itemsResult.rows) {
      const stockResult = await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id`,
        [item.quantity, item.product_id]
      );
      if (stockResult.rows.length === 0) {
        throw Object.assign(new Error("Stock insuficiente al confirmar el pago."), { code: "INSUFFICIENT_STOCK" });
      }
    }

    // SFTWRKEY-417: el pedido nace como 'pagado' y queda la primera fila del historial
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, total, status) VALUES ($1, $2, 'pagado') RETURNING id, created_at`,
      [userId, total]
    );
    const orderId = orderResult.rows[0].id;
    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status) VALUES ($1, NULL, 'pagado')`,
      [orderId]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    // SFTWRKEY-299: Registrar pago en base de datos, dentro de la misma transacción
    // que la orden — si esto falla, el ROLLBACK revierte también la orden y el stock.
    const paymentInsert = await client.query(
      `INSERT INTO payments
         (order_id, user_id, amount, status, gateway_reference, auth_code, card_brand, card_last4, decline_code, decline_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, order_id, status, card_brand, card_last4, created_at`,
      [
        orderId, userId, total, "aprobado",
        gatewayResult.transactionId, gatewayResult.authCode, gatewayResult.brand,
        gatewayResult.last4, gatewayResult.declineCode, gatewayResult.declineMessage,
      ]
    );
    const payment = paymentInsert.rows[0];

    await client.query('COMMIT');

    // SFTWRKEY-447: correo de confirmación; no frena la respuesta ni la compra si falla
    void notifyOrderStatus(pool, orderId, 'pagado');

    // SFTWRKEY-298: datos que la página de confirmación necesita mostrar
    return res.status(201).json({
      success: true,
      message: "Compra realizada con éxito.",
      order: { id: orderId, total, created_at: orderResult.rows[0].created_at },
      payment: {
        id: payment.id,
        status: payment.status,
        brand: gatewayResult.brand,
        last4: gatewayResult.last4,
        authCode: gatewayResult.authCode,
      },
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Error en checkout:", err);
    if (err instanceof PaymentGatewayError) {
      return res.status(502).json({ success: false, code: err.code, message: "No se pudo contactar a la pasarela de pago. Intenta de nuevo." });
    }
    if (err.code === "INSUFFICIENT_STOCK") {
      return res.status(409).json({ success: false, code: "INSUFFICIENT_STOCK", message: "Algunos productos ya no tienen stock suficiente." });
    }
    return res.status(500).json({
      success: false,
      code: "PAYMENT_ERROR",
      message: "No se pudo procesar el pago. Intenta de nuevo."
    });
  } finally {
    client.release();
  }
});

export default router;