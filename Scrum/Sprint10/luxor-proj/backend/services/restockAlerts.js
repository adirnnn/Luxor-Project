// SFTWRKEY-450: "Avísame cuando vuelva". Cuando un perfume agotado vuelve a tener stock (panel,
// importación CSV, cancelación de un pedido o un pago abandonado que devuelve unidades) se manda
// un solo correo a cada persona que pidió el aviso. Nunca lanza error: el cambio de stock ya quedó guardado.
import crypto from 'node:crypto';
import pool from '../db.js';
import { isMailConfigured, sendRestockEmail } from './mailer.js';

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS restock_alerts (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    consent_at TIMESTAMPTZ NOT NULL,
    token_hash VARCHAR(64) UNIQUE,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS restock_alerts_pending_uniq
    ON restock_alerts (product_id, email) WHERE notified_at IS NULL;
`;

// consent_at: el correo solo se guarda si la persona marcó la casilla de consentimiento.
// token_hash: se llena al mandar el aviso; con él se cancelan los demás avisos de ese correo.
// notified_at: cuando se mandó el correo; una fila avisada no se vuelve a mandar.
let tableReady;
export const ensureRestockAlertsTable = (db = pool) => {
  if (!tableReady) {
    tableReady = db.query(CREATE_TABLE).catch((err) => {
      tableReady = undefined;
      throw err;
    });
  }
  return tableReady;
};

let warnedNoMail = false;

export async function notifyRestock(productIds, deps = {}) {
  const { db = pool, send = sendRestockEmail, env = process.env, logger = console } = deps;
  const ids = [...new Set((productIds ?? []).filter((id) => typeof id === 'string' && id))];
  if (!ids.length) return { sent: 0 };

  // sin proveedor de correo los avisos se quedan pendientes para cuando sí lo haya
  if (!isMailConfigured(env)) {
    if (!warnedNoMail) {
      warnedNoMail = true;
      logger.warn('Avisos de "Avísame cuando vuelva" sin enviar: falta RESEND_API_KEY.');
    }
    return { sent: 0 };
  }

  let sent = 0;
  try {
    await ensureRestockAlertsTable(db);
    // Se marcan como avisados en la misma consulta que los busca: si llegan dos reposiciones al
    // mismo tiempo, cada fila la toma una sola, y cada persona recibe un solo correo.
    const claimed = await db.query(
      `UPDATE restock_alerts a SET notified_at = NOW()
       FROM products p
       WHERE a.product_id = p.id AND a.product_id = ANY($1::varchar[])
         AND a.notified_at IS NULL AND p.stock > 0
       RETURNING a.id, a.email, p.id AS product_id, p.name, p.price`,
      [ids]
    );

    const base = (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    for (const alert of claimed.rows) {
      try {
        // el enlace para no recibir más avisos: en la base solo queda su hash
        const token = crypto.randomBytes(32).toString('hex');
        await db.query('UPDATE restock_alerts SET token_hash = $2 WHERE id = $1', [alert.id, hashToken(token)]);
        await send({
          to: alert.email,
          env,
          productName: alert.name,
          price: alert.price === null ? null : Number(alert.price),
          productUrl: `${base}/producto/${encodeURIComponent(alert.product_id)}`,
          unsubscribeUrl: `${base}/avisos/cancelar?token=${token}`,
        });
        sent += 1;
      } catch (err) {
        // si el correo no salió, el aviso vuelve a quedar pendiente para la siguiente reposición
        logger.error(`No se pudo enviar el aviso de stock de ${alert.product_id}:`, err.message);
        await db
          .query('UPDATE restock_alerts SET notified_at = NULL, token_hash = NULL WHERE id = $1', [alert.id])
          .catch(() => {});
      }
    }
  } catch (err) {
    logger.error('No se pudieron revisar los avisos de stock:', err.message);
  }
  return { sent };
}
