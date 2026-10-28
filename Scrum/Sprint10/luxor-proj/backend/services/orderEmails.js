// SFTWRKEY-447 / SFTWRKEY-448: busca los datos del pedido y manda el correo al cliente.
// Nunca lanza error: si el correo falla, la compra o el cambio de estado ya quedaron guardados.
import { isMailConfigured, sendOrderEmail, ORDER_EMAIL_STATUSES } from './mailer.js';
import { deliveryView } from './shipping.js';

export async function notifyOrderStatus(db, orderId, status, deps = {}) {
  const { send = sendOrderEmail, env = process.env, logger = console } = deps;
  try {
    if (!ORDER_EMAIL_STATUSES.includes(status)) return { sent: false };
    if (!isMailConfigured(env)) {
      logger.warn(`Correo del pedido #${orderId} no enviado: falta RESEND_API_KEY.`);
      return { sent: false };
    }

    const orderResult = await db.query(
      `SELECT o.id, o.user_id, o.total, o.shipping_cost, o.delivery_method, o.delivery_address,
              COALESCE(u.email, g.guest_email) AS email,
              COALESCE(u.name, g.guest_name) AS name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN guest_receipts g ON g.order_id = o.id
       WHERE o.id = $1`,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order?.email) {
      logger.warn(`Correo del pedido #${orderId} no enviado: el pedido no tiene correo.`);
      return { sent: false };
    }

    const itemsResult = await db.query(
      `SELECT p.name, oi.quantity, oi.unit_price
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [orderId]
    );

    const base = (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    return await send({
      to: order.email,
      env,
      status,
      orderId: order.id,
      customerName: order.name,
      items: itemsResult.rows.map((i) => ({ ...i, name: i.name ?? 'Producto' })),
      total: Number(order.total),
      // SFTWRKEY-449: el correo muestra el envío para que los renglones sumen el total
      shipping: Number(order.shipping_cost ?? 0),
      delivery: deliveryView(order),
      // los invitados no tienen cuenta: sin enlace, porque los llevaría al login
      accountUrl: order.user_id ? `${base}/mi-cuenta` : null,
    });
  } catch (err) {
    logger.error(`No se pudo enviar el correo del pedido #${orderId}:`, err.message);
    return { sent: false };
  }
}
