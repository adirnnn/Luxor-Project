import express, { Router } from 'express';
import pool from '../db.js';
import { rateLimit } from '../services/rateLimit.js';
import { verifyWebhookSignature } from '../services/webhookSignature.js';
import { ensureCheckoutTables, findSessionIdByCheckout, confirmSession } from '../services/checkoutSessions.js';
import { clientIp } from '../services/clientIp.js';

// SFTWRKEY-446: Recurrente avisa aquí cuando un pago se aprueba o se rechaza, aunque el cliente
// haya cerrado la página antes de volver a la tienda.
//
// - Sin firma válida (RECURRENTE_WEBHOOK_SECRET) responde 401 y no cambia nada.
// - El aviso no se cree a ciegas: confirmSession le vuelve a preguntar a Recurrente con la llave
//   secreta si el checkout está pagado, y es el mismo camino que usa /pago/resultado.
// - Un aviso repetido (mismo svix-id) no se procesa dos veces, y el pedido se crea una sola vez
//   aunque lleguen el aviso y la vuelta del cliente al mismo tiempo (FOR UPDATE + índice único).
// - Cada aviso queda en payment_webhook_events.
const router = Router();

const PAID_EVENTS = new Set(['intent.succeeded', 'payment_intent.succeeded']);
const FAILED_EVENTS = new Set(['intent.failed', 'payment_intent.failed']);

// Solo se guarda lo necesario para revisar el pago, sin el nombre ni el correo del cliente
const summarize = (event) => ({
  id: event.id ?? null,
  event_type: event.event_type ?? null,
  status: event.status ?? null,
  amount_in_cents: event.amount_in_cents ?? null,
  currency: event.currency ?? null,
  checkout: event.checkout ? { id: event.checkout.id ?? null, status: event.checkout.status ?? null } : null,
  payment: event.payment ? { id: event.payment.id ?? null } : null,
  failure_reason: event.details?.failure_reason ?? null,
  live_mode: event.live_mode ?? null,
});

const finish = (eventRowId, status, { orderId = null, detail = null } = {}) =>
  pool.query(
    `UPDATE payment_webhook_events
     SET status = $2, order_id = $3, detail = $4, processed_at = NOW()
     WHERE id = $1`,
    [eventRowId, status, orderId, detail]
  );

router.post(
  '/webhooks/recurrente',
  rateLimit({ windowMs: 60_000, max: 120 }),
  // la firma se calcula sobre el cuerpo exacto, así que aquí no se usa express.json
  express.raw({ type: '*/*', limit: '256kb' }),
  async (req, res) => {
    const secret = process.env.RECURRENTE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('Webhook de Recurrente recibido pero falta RECURRENTE_WEBHOOK_SECRET.');
      // 503: Recurrente reintenta más tarde, cuando el secreto ya esté configurado
      return res.status(503).json({ received: false });
    }

    const providerEventId = req.get('svix-id') || null;
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    try {
      await ensureCheckoutTables();

      const valid = verifyWebhookSignature({
        secret,
        id: providerEventId,
        timestamp: req.get('svix-timestamp'),
        signature: req.get('svix-signature'),
        body,
      });
      if (!valid) {
        // queda registrado (sin el contenido, que no es de fiar) y no se toca nada más
        await pool.query(
          `INSERT INTO payment_webhook_events (status, ip, detail, processed_at)
           VALUES ('firma_invalida', $1, $2, NOW())`,
          [clientIp(req), providerEventId ? `svix-id ${String(providerEventId).slice(0, 100)}` : 'sin svix-id']
        );
        return res.status(401).json({ received: false });
      }

      let event;
      try {
        event = JSON.parse(body.toString('utf8'));
      } catch {
        return res.status(400).json({ received: false });
      }
      const eventType = String(event.event_type ?? '').slice(0, 60);
      const checkoutId = event.checkout?.id ? String(event.checkout.id).slice(0, 100) : null;

      // Un aviso repetido: si ya se procesó, solo se confirma; si falló antes, se reintenta
      const inserted = await pool.query(
        `INSERT INTO payment_webhook_events (provider_event_id, event_type, checkout_id, status, payload, ip)
         VALUES ($1, $2, $3, 'recibido', $4, $5)
         ON CONFLICT (provider_event_id) DO NOTHING
         RETURNING id`,
        [providerEventId, eventType, checkoutId, summarize(event), clientIp(req)]
      );
      let eventRowId = inserted.rows[0]?.id;
      if (!eventRowId) {
        const prior = (
          await pool.query('SELECT id, status FROM payment_webhook_events WHERE provider_event_id = $1', [providerEventId])
        ).rows[0];
        if (prior.status !== 'error') return res.json({ received: true, duplicate: true });
        eventRowId = prior.id;
      }

      const sessionId = checkoutId ? await findSessionIdByCheckout(checkoutId) : null;

      if (!PAID_EVENTS.has(eventType)) {
        const detail = FAILED_EVENTS.has(eventType) ? summarize(event).failure_reason : null;
        // un rechazo no cierra la sesión: el cliente puede intentar con otra tarjeta en Recurrente
        await finish(eventRowId, FAILED_EVENTS.has(eventType) ? 'rechazo' : 'ignorado', { detail });
        return res.json({ received: true });
      }

      if (!sessionId) {
        // un checkout que no es de esta tienda (por ejemplo, un enlace de pago creado a mano)
        await finish(eventRowId, 'ignorado', { detail: 'checkout sin sesión de la tienda' });
        return res.json({ received: true });
      }

      const result = await confirmSession(sessionId);
      if (result?.status !== 'pagado') {
        // el aviso llegó antes de que la API de Recurrente lo muestre pagado: 500 para que reintente
        await finish(eventRowId, 'error', { detail: `Recurrente todavía no lo muestra pagado (${result?.status})` });
        return res.status(500).json({ received: false });
      }

      await finish(eventRowId, 'procesado', { orderId: result.order.id });
      return res.json({ received: true });
    } catch (err) {
      console.error('Error procesando el webhook de Recurrente:', err.message);
      if (providerEventId) {
        await pool
          .query(
            `UPDATE payment_webhook_events SET status = 'error', detail = $2, processed_at = NOW()
             WHERE provider_event_id = $1`,
            [providerEventId, String(err.message).slice(0, 500)]
          )
          .catch(() => {});
      }
      // Recurrente reintenta (1 min, 5 min, 30 min, 2 h, 6 h)
      return res.status(500).json({ received: false });
    }
  }
);

export default router;
