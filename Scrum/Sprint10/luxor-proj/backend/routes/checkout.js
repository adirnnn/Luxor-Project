import { Router } from 'express';
import pool from '../db.js';
import { authenticate, authorizeSelfOrRoles } from '../services/auth.js';
import { rateLimit } from '../services/rateLimit.js';
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from '../services/securityEvents.js';
import { PaymentGatewayError } from '../services/paymentGateway.js';
import {
  UUID_REGEX,
  ensureCheckoutTables,
  reserveStock,
  createSession,
  openCheckout,
  confirmSession,
  cancelSession,
  cancelPendingForUser,
} from '../services/checkoutSessions.js';

// SFTWRKEY-445: compra con cuenta y vuelta desde la página de pago de Recurrente.
// La compra como invitado empieza en commerce.js (/guest-checkout) y vuelve por estas mismas rutas.
const router = Router();

const onBlock = (req) =>
  recordSecurityEvent({ type: SECURITY_EVENT_TYPES.RATE_LIMITED, ip: req.ip, path: req.path });

// Respuesta común para errores de la pasarela y del stock
export function sendCheckoutError(res, err) {
  if (err instanceof PaymentGatewayError) {
    console.error('Error de la pasarela:', err.message);
    if (err.code === 'GATEWAY_NOT_CONFIGURED') {
      return res.status(503).json({ success: false, code: err.code, message: 'Los pagos en línea no están disponibles en este momento.' });
    }
    return res.status(502).json({ success: false, code: 'GATEWAY_ERROR', message: 'No se pudo contactar a la pasarela de pago. Intenta de nuevo.' });
  }
  if (err.status && err.code) {
    return res.status(err.status).json({ success: false, code: err.code, message: err.message, items: err.items });
  }
  console.error('Error en el checkout:', err);
  return res.status(500).json({ success: false, code: 'PAYMENT_ERROR', message: 'No se pudo procesar el pago. Intenta de nuevo.' });
}

// La referencia es el UUID aleatorio de la sesión; solo lo conoce quien inició el pago
const reference = (req) => {
  const ref = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
  return UUID_REGEX.test(ref) ? ref : null;
};

const returnLimit = rateLimit({ windowMs: 60_000, max: 30, onBlock });

router.post('/checkout/confirm', returnLimit, async (req, res) => {
  const ref = reference(req);
  if (!ref) return res.status(400).json({ success: false, message: 'Referencia de pago no válida.' });
  try {
    const result = await confirmSession(ref);
    if (!result) return res.status(404).json({ success: false, message: 'No encontramos ese pago.' });
    res.set('Cache-Control', 'no-store').json({ success: true, ...result });
  } catch (err) {
    sendCheckoutError(res, err);
  }
});

router.post('/checkout/cancel', returnLimit, async (req, res) => {
  const ref = reference(req);
  if (!ref) return res.status(400).json({ success: false, message: 'Referencia de pago no válida.' });
  try {
    const result = await cancelSession(ref);
    if (!result) return res.status(404).json({ success: false, message: 'No encontramos ese pago.' });
    res.set('Cache-Control', 'no-store').json({ success: true, ...result });
  } catch (err) {
    sendCheckoutError(res, err);
  }
});

// SFTWRKEY-295/296: abre el pago del carrito del usuario. El total sale de la base, nunca del
// cliente, y el cuerpo de la petición no lleva datos de tarjeta.
router.post(
  '/checkout/:userId',
  authenticate,
  authorizeSelfOrRoles('userId', 'ADMIN'),
  rateLimit({ windowMs: 60_000, max: 10, onBlock }),
  async (req, res) => {
    const userId = Number(req.params.userId);
    try {
      await ensureCheckoutTables();
      const cart = await pool.query(
        `SELECT ci.product_id, ci.quantity
         FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
         WHERE c.user_id = $1`,
        [userId]
      );
      if (cart.rows.length === 0) {
        return res.status(400).json({ success: false, code: 'EMPTY_CART', message: 'Tu carrito está vacío.' });
      }

      // un pago que el usuario dejó a medias libera su stock antes de abrir otro
      await cancelPendingForUser(userId);

      const client = await pool.connect();
      let session;
      try {
        await client.query('BEGIN');
        const { lines, cents } = await reserveStock(client, cart.rows);
        session = await createSession(client, { userId, lines, cents });
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }

      const checkoutUrl = await openCheckout(session);
      res.status(201).json({ success: true, checkoutUrl, reference: session.id, total: session.cents / 100 });
    } catch (err) {
      sendCheckoutError(res, err);
    }
  }
);

export default router;
