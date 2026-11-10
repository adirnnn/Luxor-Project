// Verificación del correo de las cuentas que el cliente crea desde la tienda.
// - Igual que recuperar contraseña: el token es al azar y en la base solo se guarda su hash.
// - Vence a las 24 horas y sirve una vez; pedir otro invalida los anteriores.
// - Las cuentas que ya existían, las que crea el admin y las de Google cuentan como verificadas
//   (la columna email_verified es TRUE por defecto); solo el registro desde la tienda la pone en FALSE.
// - Sin proveedor de correo (desarrollo y pruebas) la cuenta se crea verificada: nadie podría confirmarla.
import crypto from 'node:crypto';
import { isMailConfigured, sendVerificationEmail } from './mailer.js';

export const VERIFICATION_TTL_HOURS = 24;

export const hashVerificationToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// la tienda pide verificación solo si puede mandar el correo y no lo está creando un admin
export const needsVerification = ({ requester, env = process.env }) =>
  isMailConfigured(env) && requester?.role !== 'ADMIN';

let tableReady;
export const ensureVerificationTable = (pool) => {
  if (!tableReady) {
    tableReady = (async () => {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(64) NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
    })().catch((err) => {
      tableReady = undefined;
      throw err;
    });
  }
  return tableReady;
};

const frontendBase = (env) => (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

// crea un enlace nuevo (los anteriores dejan de servir) y manda el correo
export async function startVerification({ pool, user, env = process.env, send = sendVerificationEmail }) {
  await ensureVerificationTable(pool);
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
    [user.id]
  );
  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' hours')::interval)`,
    [user.id, hashVerificationToken(token), String(VERIFICATION_TTL_HOURS)]
  );
  const link = `${frontendBase(env)}/verificar-correo?token=${token}`;
  return send({ to: user.email, name: user.name, link, env });
}

// gasta el token (una sola vez, aunque lleguen dos peticiones juntas) y marca la cuenta
export async function confirmVerification({ pool, token }) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  await ensureVerificationTable(pool);
  const spent = await pool.query(
    `UPDATE email_verification_tokens SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [hashVerificationToken(token)]
  );
  if (spent.rows.length === 0) return null;
  const userId = spent.rows[0].user_id;
  await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [userId]);
  return userId;
}

export async function isEmailVerified(pool, userId) {
  await ensureVerificationTable(pool);
  const result = await pool.query('SELECT email_verified FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.email_verified !== false;
}
