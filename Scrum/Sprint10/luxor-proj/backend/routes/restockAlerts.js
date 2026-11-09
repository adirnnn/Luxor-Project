import { Router } from 'express';
import pool from '../db.js';
import { rateLimit } from '../services/rateLimit.js';
import { EMAIL_REGEX } from '../services/authHandlers.js';
import { ensureRestockAlertsTable, hashToken } from '../services/restockAlerts.js';

// SFTWRKEY-450: "Avísame cuando vuelva" para perfumes agotados.
// - El correo se guarda solo si la persona da su consentimiento.
// - Responde lo mismo aunque el correo ya estuviera anotado, para no revelar qué correos hay.
// - El aviso lo manda services/restockAlerts.js cuando el stock pasa de 0 a más de 0.
const router = Router();

const limiter = () => rateLimit({ windowMs: 15 * 60_000, max: 5 });

router.post('/restock-alerts', limiter(), async (req, res) => {
  const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!productId || productId.length > 100) {
    return res.status(400).json({ success: false, message: 'El perfume no es válido.' });
  }
  if (email.length > 254 || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: 'Ingresa un correo válido.' });
  }
  if (req.body?.consent !== true) {
    return res.status(400).json({ success: false, message: 'Debes aceptar que te escribamos para avisarte.' });
  }

  try {
    await ensureRestockAlertsTable();
    const product = await pool.query('SELECT id, stock FROM products WHERE id = $1', [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }
    if (Number(product.rows[0].stock) > 0) {
      return res.status(409).json({ success: false, message: 'Este perfume ya está disponible. Puedes comprarlo ahora.' });
    }

    await pool.query(
      `INSERT INTO restock_alerts (product_id, email, consent_at) VALUES ($1, $2, NOW())
       ON CONFLICT (product_id, email) WHERE notified_at IS NULL DO NOTHING`,
      [productId, email]
    );
    res.status(201).json({
      success: true,
      message: 'Listo. Te escribiremos una sola vez a ese correo cuando este perfume vuelva.',
    });
  } catch (err) {
    console.error('Error al guardar el aviso de stock:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo guardar el aviso. Intenta de nuevo.' });
  }
});

// "No recibir más avisos": el enlace del correo trae un token; se borran los avisos pendientes de ese correo
router.post('/restock-alerts/unsubscribe', limiter(), async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ success: false, message: 'El enlace no es válido.' });
  }

  try {
    await ensureRestockAlertsTable();
    await pool.query(
      `DELETE FROM restock_alerts
       WHERE notified_at IS NULL
         AND email = (SELECT email FROM restock_alerts WHERE token_hash = $1)`,
      [hashToken(token)]
    );
    res.json({ success: true, message: 'Listo. Ya no te enviaremos avisos de perfumes agotados.' });
  } catch (err) {
    console.error('Error al cancelar los avisos de stock:', err.message);
    res.status(500).json({ success: false, message: 'No se pudieron cancelar los avisos. Intenta de nuevo.' });
  }
});

export default router;
