import pool from '../db.js';

// SFTWRKEY-401: eventos de seguridad y alertas del admin
export const SECURITY_EVENT_TYPES = {
  LOGIN_FAILED: 'LOGIN_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
};

// cuantos fallos en 15 min cuentan como alerta
export const FAILED_LOGIN_THRESHOLD = 10;
export const ALERT_WINDOW_MINUTES = 15;
const RECENT_EVENTS_LIMIT = 50;

let tableReady;

const ensureSecurityEventsTable = () => {
  if (!tableReady) {
    tableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS security_events (
        id BIGSERIAL PRIMARY KEY,
        type VARCHAR(30) NOT NULL,
        ip VARCHAR(64),
        email VARCHAR(150),
        path VARCHAR(200),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS security_events_type_created_idx
        ON security_events (type, created_at DESC);
    `).catch((err) => {
      tableReady = undefined;
      throw err;
    });
  }
  return tableReady;
};

const clip = (value, max) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

// si falla no rompe el login
export async function recordSecurityEvent({ type, ip, email, path }) {
  try {
    await ensureSecurityEventsTable();
    await pool.query(
      'INSERT INTO security_events (type, ip, email, path) VALUES ($1, $2, $3, $4)',
      [type, clip(ip, 64), clip(email, 150)?.toLowerCase() ?? null, clip(path, 200)]
    );
  } catch (err) {
    console.error('No se pudo registrar el evento de seguridad:', err.message);
  }
}

export async function getSecurityAlerts({
  threshold = FAILED_LOGIN_THRESHOLD,
  windowMinutes = ALERT_WINDOW_MINUTES,
} = {}) {
  await ensureSecurityEventsTable();

  const byIp = await pool.query(
    `SELECT ip, COUNT(*)::int AS attempts, MAX(created_at) AS last_at
     FROM security_events
     WHERE type = $1 AND ip IS NOT NULL
       AND created_at > NOW() - make_interval(mins => $2)
     GROUP BY ip
     HAVING COUNT(*) >= $3
     ORDER BY attempts DESC, last_at DESC`,
    [SECURITY_EVENT_TYPES.LOGIN_FAILED, windowMinutes, threshold]
  );

  // misma cuenta desde varias ips
  const byAccount = await pool.query(
    `SELECT email, COUNT(*)::int AS attempts, MAX(created_at) AS last_at
     FROM security_events
     WHERE type = $1 AND email IS NOT NULL
       AND created_at > NOW() - make_interval(mins => $2)
     GROUP BY email
     HAVING COUNT(*) >= $3
     ORDER BY attempts DESC, last_at DESC`,
    [SECURITY_EVENT_TYPES.LOGIN_FAILED, windowMinutes, threshold]
  );

  const recent = await pool.query(
    `SELECT id::text AS id, type, ip, email, path, created_at
     FROM security_events
     WHERE created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [RECENT_EVENTS_LIMIT]
  );

  const alerts = [
    ...byIp.rows.map((row) => ({ kind: 'ip', target: row.ip, attempts: row.attempts, last_at: row.last_at })),
    ...byAccount.rows.map((row) => ({ kind: 'account', target: row.email, attempts: row.attempts, last_at: row.last_at })),
  ];

  return { threshold, windowMinutes, alerts, recent: recent.rows };
}
