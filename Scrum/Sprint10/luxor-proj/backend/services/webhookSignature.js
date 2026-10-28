// SFTWRKEY-446: firma de los webhooks de Recurrente (los manda con Svix).
// https://docs.recurrente.com/guias-espanol/comenzar/webhooks
// Cada aviso trae svix-id, svix-timestamp y svix-signature ("v1,<base64>", puede traer varias
// separadas por espacio). La firma es HMAC-SHA256 de "<id>.<timestamp>.<cuerpo tal cual llegó>"
// con la parte en base64 del secreto whsec_... Sin la firma correcta nadie puede inventar un pago.
import crypto from 'node:crypto';

// un aviso con más de 5 minutos de diferencia se rechaza (evita que reenvíen uno viejo)
export const TOLERANCE_SECONDS = 5 * 60;

export function signPayload({ secret, id, timestamp, body }) {
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  return crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
}

export function verifyWebhookSignature({ secret, id, timestamp, signature, body, now = Date.now() }) {
  if (!secret || !id || !timestamp || !signature) return false;

  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(signPayload({ secret, id, timestamp, body: Buffer.isBuffer(body) ? body.toString('utf8') : String(body) }));
  return String(signature)
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('v1,'))
    .some((part) => {
      const received = Buffer.from(part.slice(3));
      // comparación de tiempo constante: no revela cuántos caracteres coinciden
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    });
}
