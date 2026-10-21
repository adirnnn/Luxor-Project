import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { rateLimit } from '../services/rateLimit.js';
import { EMAIL_REGEX, MIN_PASSWORD_LENGTH, DEFAULT_SALT_ROUNDS } from '../services/authHandlers.js';
import { sendPasswordResetEmail, isMailConfigured } from '../services/mailer.js';

// SFTWRKEY-428: recuperar contraseña.
// - El token se genera al azar y en la base solo se guarda su hash (SHA-256).
// - Vence a los 30 minutos y solo sirve una vez.
// - /auth/forgot-password responde siempre lo mismo para no revelar qué correos existen.

const router = Router();

export const TOKEN_TTL_MINUTES = 30;
const GENERIC_MESSAGE = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

let tableReady;
const ensureTable = () => {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(64) NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .catch((err) => {
        tableReady = undefined;
        throw err;
      });
  }
  return tableReady;
};

const limiter = () => rateLimit({ windowMs: 15 * 60_000, max: 5 });

router.post('/auth/forgot-password', limiter(), async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: 'Ingresa un correo válido.' });
  }

  try {
    await ensureTable();
    const found = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    const body = { success: true, message: GENERIC_MESSAGE };

    if (found.rows.length > 0) {
      const userId = found.rows[0].id;
      const token = crypto.randomBytes(32).toString('hex');

      // un solo enlace vigente por usuario: los anteriores dejan de servir
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [userId]
      );
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
        [userId, hashToken(token), String(TOKEN_TTL_MINUTES)]
      );

      const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const link = `${base}/restablecer-contrasena?token=${token}`;

      if (isMailConfigured()) {
        await sendPasswordResetEmail({ to: email, link });
      } else if (process.env.PASSWORD_RESET_DEV_LINKS === 'true') {
        // Solo para desarrollo local (docker-compose): sin proveedor de correo, el enlace se
        // muestra en la consola y en la respuesta. En Render esta variable no existe.
        console.log(`[password-reset] enlace para ${email}: ${link}`);
        body.devResetUrl = link;
      } else {
        console.warn('[password-reset] no hay RESEND_API_KEY: no se envió el correo.');
      }
    }

    return res.json(body);
  } catch (err) {
    console.error('Error en forgot-password:', err.message);
    return res.status(500).json({ success: false, message: 'No se pudo procesar la solicitud.' });
  }
});

router.post('/auth/reset-password', limiter(), async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ success: false, message: 'El enlace no es válido o ya venció.' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    });
  }

  let client;
  try {
    await ensureTable();
    const hash = await bcrypt.hash(password, DEFAULT_SALT_ROUNDS);
    client = await pool.connect();
    await client.query('BEGIN');

    // "used_at IS NULL" dentro de un UPDATE hace que el token solo se pueda gastar una vez
    // aunque lleguen dos peticiones al mismo tiempo.
    const spent = await client.query(
      `UPDATE password_reset_tokens SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [hashToken(token)]
    );

    if (spent.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'El enlace no es válido o ya venció.' });
    }

    await client.query('UPDATE users SET password = $1 WHERE id = $2', [hash, spent.rows[0].user_id]);
    await client.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [spent.rows[0].user_id]
    );
    await client.query('COMMIT');

    return res.json({ success: true, message: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.' });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error en reset-password:', err.message);
    return res.status(500).json({ success: false, message: 'No se pudo restablecer la contraseña.' });
  } finally {
    client?.release();
  }
});

export default router;
