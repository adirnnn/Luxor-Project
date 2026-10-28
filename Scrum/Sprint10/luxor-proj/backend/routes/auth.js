import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { signToken } from '../services/auth.js';
import { createLoginHandler, createRegisterHandler } from '../services/authHandlers.js';
import { rateLimit } from '../services/rateLimit.js';
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from '../services/securityEvents.js';
import { onRateLimitBlock } from '../services/securityAudit.js';

const router = Router();
const SALT_ROUNDS = 12;

// ── Auth ──────────────────────────────────────────────────────────────────────
// SFTWRKEY-401: guardar logins fallidos y bloqueos
const onLoginFailed = ({ email, req }) =>
  recordSecurityEvent({ type: SECURITY_EVENT_TYPES.LOGIN_FAILED, ip: req.ip, email, path: req.path });

router.post("/login", rateLimit({ windowMs: 60_000, max: 10, onBlock: onRateLimitBlock }), createLoginHandler({ pool, bcrypt, signToken, onLoginFailed }));

// SFTWRKEY-220 + SFTWRKEY-223: Register con validación de campos y email duplicado
// SFTWRKEY-408: máximo 6 registros por hora por IP (evita cuentas masivas y averiguar
// correos registrados con el 409); el bloqueo queda como evento de seguridad.
router.post("/register", rateLimit({ windowMs: 60 * 60_000, max: 6, onBlock: onRateLimitBlock }), createRegisterHandler({ pool, bcrypt, saltRounds: SALT_ROUNDS }));

export default router;