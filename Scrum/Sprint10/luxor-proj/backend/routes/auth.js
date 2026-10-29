import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { signToken, setSessionCookie, clearSessionCookie, authenticate } from '../services/auth.js';
import { createLoginHandler, createRegisterHandler } from '../services/authHandlers.js';
import { rateLimit } from '../services/rateLimit.js';
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from '../services/securityEvents.js';
import { onRateLimitBlock } from '../services/securityAudit.js';
import { clientIp } from '../services/clientIp.js';
import { WHOLESALE_ROLE, getWholesalePercent } from '../services/wholesale.js';

const router = Router();
const SALT_ROUNDS = 12;

// ── Auth ──────────────────────────────────────────────────────────────────────
// SFTWRKEY-401: guardar logins fallidos y bloqueos
const onLoginFailed = ({ email, req }) =>
  recordSecurityEvent({ type: SECURITY_EVENT_TYPES.LOGIN_FAILED, ip: clientIp(req), email, path: req.path });

router.post("/login", rateLimit({ windowMs: 60_000, max: 10, onBlock: onRateLimitBlock }), createLoginHandler({ pool, bcrypt, signToken, setSessionCookie, onLoginFailed }));

// SFTWRKEY-451: cerrar sesión borra la cookie (con la cookie httpOnly el frontend no puede borrarla)
router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

// SFTWRKEY-451: el frontend pregunta aquí si la sesión de la cookie sigue vigente y de quién es
router.get("/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, r.nombre AS role,
              EXTRACT(EPOCH FROM a.updated_at)::bigint AS "avatarVersion"
       FROM users u JOIN rol r ON u.role = r.id_rol
       LEFT JOIN user_avatars a ON a.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      clearSessionCookie(res);
      return res.status(401).json({ success: false, message: 'Sesión inválida o expirada.' });
    }
    res.set('Cache-Control', 'no-store');
    const user = result.rows[0];
    // feedback del cliente: con la versión el navegador pide la foto nueva cuando cambia
    user.avatarVersion = user.avatarVersion == null ? null : Number(user.avatarVersion);
    // feedback del cliente: el mayorista ve sus precios con su porcentaje en la tienda
    if (user.role === WHOLESALE_ROLE) user.wholesalePercent = await getWholesalePercent(pool);
    res.json({ success: true, user });
  } catch (err) {
    console.error('Error leyendo la sesión:', err.message);
    res.status(500).json({ success: false });
  }
});

// SFTWRKEY-220 + SFTWRKEY-223: Register con validación de campos y email duplicado
// SFTWRKEY-408: máximo 6 registros por hora por IP (evita cuentas masivas y averiguar
// correos registrados con el 409); el bloqueo queda como evento de seguridad.
router.post("/register", rateLimit({ windowMs: 60 * 60_000, max: 6, onBlock: onRateLimitBlock }), createRegisterHandler({ pool, bcrypt, saltRounds: SALT_ROUNDS }));

export default router;