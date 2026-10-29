import { Router } from 'express';
import pool from '../db.js';
import { authenticate, optionalAuthenticate, requireRoles } from '../services/auth.js';
import { rateLimit } from '../services/rateLimit.js';
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from '../services/securityEvents.js';
import {
  DISCOUNT_TYPES,
  couponError,
  couponState,
  findUsableCoupon,
  normalizeCode,
} from '../services/coupons.js';
import { clientIp } from '../services/clientIp.js';

// SFTWRKEY-432: cupones de descuento. El cliente puede probar un código antes de pagar (solo es
// una vista previa: el cobro lo vuelve a calcular createSession) y el admin los crea y desactiva.
const router = Router();

// Los bloqueos quedan como evento de seguridad (alertas del admin), igual que el login
const onBlock = (req) =>
  recordSecurityEvent({ type: SECURITY_EVENT_TYPES.RATE_LIMITED, ip: clientIp(req), path: req.path });

// 10 códigos por minuto por IP: suficiente para quien escribe su cupón, muy poco para adivinarlos
export const VALIDATE_LIMIT = { windowMs: 60_000, max: 10 };
const validateLimit = rateLimit({ ...VALIDATE_LIMIT, onBlock });

const ID_REGEX = /^\d+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_REGEX = /^\d+(?:\.\d{1,2})?$/;
const MAX_AMOUNT = 100000;

// mismos límites del carrito de invitado (commerce.js)
function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) return null;
  const seen = new Set();
  const parsed = [];
  for (const item of items) {
    const id = typeof item?.product_id === 'string' ? item.product_id.trim() : '';
    if (!id || id.length > 100 || seen.has(id)) return null;
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) return null;
    seen.add(id);
    parsed.push({ product_id: id, quantity: item.quantity });
  }
  return parsed;
}

const publicCoupon = (coupon) => ({
  code: coupon.code,
  discount_type: coupon.discount_type,
  value: Number(coupon.value),
  min_purchase: Number(coupon.min_purchase),
});

// ── Cliente: probar un cupón con el carrito actual ───────────────────────────
router.post('/coupons/validate', validateLimit, optionalAuthenticate, async (req, res) => {
  const code = normalizeCode(req.body?.code);
  if (!code) {
    return res.status(400).json({ success: false, code: 'COUPON_NOT_FOUND', message: 'Este cupón no existe o ya no está disponible.' });
  }
  const items = parseItems(req.body?.items);
  if (!items) {
    return res.status(400).json({ success: false, code: 'INVALID_CART', message: 'Revisa los productos del carrito.' });
  }

  try {
    // el subtotal sale de los precios de la base, no de lo que diga el navegador
    const products = await pool.query('SELECT id, price FROM products WHERE id = ANY($1::varchar[])', [
      items.map((item) => item.product_id),
    ]);
    let subtotal = 0;
    for (const item of items) {
      const product = products.rows.find((p) => p.id === item.product_id);
      if (!product) {
        return res.status(400).json({ success: false, code: 'INVALID_CART', message: 'Un producto del carrito ya no existe.' });
      }
      subtotal += Math.round(Number(product.price) * 100) * item.quantity;
    }

    // con sesión se revisa también si el cliente ya lo usó; para el invitado esa revisión (por
    // correo) se hace al pagar, así esta ruta no sirve para averiguar qué correos usaron un cupón
    const { coupon, discountCents: discount } = await findUsableCoupon(pool, {
      code,
      subtotalCents: subtotal,
      userId: req.user?.id ?? null,
    });

    res.set('Cache-Control', 'no-store').json({
      success: true,
      coupon: publicCoupon(coupon),
      subtotal: subtotal / 100,
      discount: discount / 100,
    });
  } catch (err) {
    if (err.status && err.code) {
      return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    }
    console.error('Error al validar el cupón:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo revisar el cupón. Intenta de nuevo.' });
  }
});

// ── Admin ────────────────────────────────────────────────────────────────────

// fecha YYYY-MM-DD que exista de verdad (2026-02-30 no pasa)
const isValidDate = (value) => {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// Guatemala no tiene horario de verano: siempre UTC-6
export const endOfDayGuatemala = (date) => new Date(`${date}T23:59:59.999-06:00`);

// Valida el cupón que crea el admin y devuelve los valores para la base
export function validateCouponInput(body) {
  const { code, discount_type: type, value, min_purchase: minPurchase, max_uses: maxUses, expires_at: expiresAt } = body ?? {};

  const normalized = normalizeCode(code);
  if (!normalized) {
    throw couponError('INVALID_COUPON', 'El código debe tener de 3 a 30 letras, números, guiones o guiones bajos.');
  }
  if (!DISCOUNT_TYPES.includes(type)) {
    throw couponError('INVALID_COUPON', "El tipo de descuento debe ser 'porcentaje' o 'monto'.");
  }
  if (value === undefined || value === null || !MONEY_REGEX.test(String(value)) || Number(value) <= 0) {
    throw couponError('INVALID_COUPON', 'El valor del descuento debe ser un número mayor que 0 con hasta dos decimales.');
  }
  if (type === 'porcentaje' && Number(value) > 100) {
    throw couponError('INVALID_COUPON', 'El porcentaje no puede ser mayor que 100.');
  }
  if (type === 'monto' && Number(value) > MAX_AMOUNT) {
    throw couponError('INVALID_COUPON', 'El monto del descuento es demasiado alto.');
  }

  const min = minPurchase === undefined || minPurchase === null || minPurchase === '' ? 0 : minPurchase;
  if (!MONEY_REGEX.test(String(min)) || Number(min) > MAX_AMOUNT) {
    throw couponError('INVALID_COUPON', 'La compra mínima debe ser un monto válido (0 si no hay mínimo).');
  }

  const uses = maxUses === undefined || maxUses === null || maxUses === '' ? null : Number(maxUses);
  if (uses !== null && (!Number.isInteger(uses) || uses < 1 || uses > 1_000_000)) {
    throw couponError('INVALID_COUPON', 'El límite de usos debe ser un número entero mayor que 0 (vacío si no tiene límite).');
  }

  if (!isValidDate(expiresAt)) {
    throw couponError('INVALID_COUPON', 'La fecha de vencimiento debe tener el formato AAAA-MM-DD.');
  }
  const expires = endOfDayGuatemala(expiresAt);
  if (expires.getTime() <= Date.now()) {
    throw couponError('INVALID_COUPON', 'La fecha de vencimiento no puede estar en el pasado.');
  }

  return { code: normalized, type, value: Number(value), minPurchase: Number(min), maxUses: uses, expires };
}

const adminCoupon = (row) => ({
  id: row.id,
  code: row.code,
  discount_type: row.discount_type,
  value: Number(row.value),
  min_purchase: Number(row.min_purchase),
  max_uses: row.max_uses,
  expires_at: row.expires_at,
  active: row.active,
  created_at: row.created_at,
  used: Number(row.used ?? 0),
  reserved: Number(row.reserved ?? 0),
  total_discount: Number(row.total_discount ?? 0),
  state: couponState(row),
});

const LIST_SQL = `
  SELECT c.*,
         COUNT(u.id) FILTER (WHERE u.status = 'usado')::int AS used,
         COUNT(u.id) FILTER (WHERE u.status = 'reservado')::int AS reserved,
         COALESCE(SUM(u.discount) FILTER (WHERE u.status = 'usado'), 0) AS total_discount
  FROM coupons c
  LEFT JOIN coupon_uses u ON u.coupon_id = c.id`;

router.get('/admin/coupons', authenticate, requireRoles('ADMIN'), async (_req, res) => {
  try {
    const result = await pool.query(`${LIST_SQL} GROUP BY c.id ORDER BY c.created_at DESC, c.id DESC`);
    res.set('Cache-Control', 'no-store').json({ success: true, coupons: result.rows.map(adminCoupon) });
  } catch (err) {
    console.error('Error al listar cupones:', err.message);
    res.status(500).json({ success: false, message: 'No se pudieron obtener los cupones.' });
  }
});

router.post('/admin/coupons', authenticate, requireRoles('ADMIN'), async (req, res) => {
  let input;
  try {
    input = validateCouponInput(req.body);
  } catch (err) {
    return res.status(400).json({ success: false, code: err.code, message: err.message });
  }

  try {
    const result = await pool.query(
      `INSERT INTO coupons (code, discount_type, value, min_purchase, max_uses, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.code, input.type, input.value, input.minPurchase, input.maxUses, input.expires, req.user.id]
    );
    res.status(201).json({ success: true, coupon: adminCoupon(result.rows[0]) });
  } catch (err) {
    // 23505: ya hay un cupón con ese código
    if (err.code === '23505') {
      return res.status(409).json({ success: false, code: 'DUPLICATE_COUPON', message: 'Ya existe un cupón con ese código.' });
    }
    console.error('Error al crear el cupón:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo crear el cupón.' });
  }
});

// Activar o desactivar. Desactivar no toca los pagos ya abiertos con el cupón.
router.patch('/admin/coupons/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!ID_REGEX.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: 'El id del cupón no es válido.' });
  }
  if (typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ success: false, message: "'active' debe ser true o false." });
  }

  try {
    const updated = await pool.query('UPDATE coupons SET active = $1 WHERE id = $2 RETURNING id', [req.body.active, id]);
    if (updated.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Cupón no encontrado.' });
    }
    const result = await pool.query(`${LIST_SQL} WHERE c.id = $1 GROUP BY c.id`, [id]);
    res.json({ success: true, coupon: adminCoupon(result.rows[0]) });
  } catch (err) {
    console.error('Error al actualizar el cupón:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo actualizar el cupón.' });
  }
});

export default router;
