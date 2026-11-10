import { Router } from 'express';
import pool from '../db.js';
import { authenticate } from '../services/auth.js';
import { rateLimit } from '../services/rateLimit.js';
import { isMailConfigured } from '../services/mailer.js';
import { confirmVerification, ensureVerificationTable, startVerification } from '../services/emailVerification.js';

// Confirmar el correo con el enlace y pedir otro enlace (ver services/emailVerification.js)
const router = Router();

router.post('/auth/verify-email', rateLimit({ windowMs: 15 * 60_000, max: 10 }), async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  try {
    const userId = await confirmVerification({ pool, token });
    if (!userId) {
      return res.status(400).json({ success: false, message: 'El enlace no es válido o ya venció. Pide uno nuevo desde Mi cuenta.' });
    }
    return res.json({ success: true, message: '¡Listo! Tu correo quedó confirmado.' });
  } catch (err) {
    console.error('Error confirmando el correo:', err.message);
    return res.status(500).json({ success: false, message: 'No se pudo confirmar el correo.' });
  }
});

// máximo 3 por hora por persona: cada uno manda un correo
router.post('/auth/resend-verification', authenticate, rateLimit({ windowMs: 60 * 60_000, max: 3 }), async (req, res) => {
  try {
    await ensureVerificationTable(pool);
    const found = await pool.query('SELECT id, name, email, email_verified FROM users WHERE id = $1', [req.user.id]);
    const user = found.rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'No encontramos tu cuenta.' });
    if (user.email_verified) return res.json({ success: true, alreadyVerified: true, message: 'Tu correo ya está confirmado.' });
    if (!isMailConfigured()) {
      return res.status(503).json({ success: false, message: 'Ahora no podemos enviar correos. Intenta más tarde.' });
    }
    await startVerification({ pool, user });
    return res.json({ success: true, message: `Te enviamos un enlace nuevo a ${user.email}.` });
  } catch (err) {
    console.error('Error reenviando la verificación:', err.message);
    return res.status(500).json({ success: false, message: 'No pudimos enviar el correo. Intenta más tarde.' });
  }
});

export default router;
