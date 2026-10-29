// Feedback del cliente: rol Mayorista. El admin le pone el rol a un cliente y ese cliente paga
// todos los perfumes con un mismo porcentaje de descuento, que el admin define en el panel.
// El descuento lo calcula el servidor al abrir el pago (igual que los cupones) y no se combina
// con cupones. El rol se lee de la base en cada compra: si el admin lo quita, aplica de inmediato.
import { MIN_CHARGE_CENTS } from './coupons.js';

export const WHOLESALE_ROLE = 'MAYORISTA';
export const DEFAULT_WHOLESALE_PERCENT = 10;
export const MIN_WHOLESALE_PERCENT = 1;
export const MAX_WHOLESALE_PERCENT = 50;

// Etiqueta que queda en el pedido (orders.coupon_code) y se muestra como "Descuento (Mayorista 10%)".
// Lleva espacio y "%", así que nunca se confunde con un código de cupón (solo letras, números, _ y -).
export const wholesaleLabel = (percent) => `Mayorista ${percent}%`;

export const isValidWholesalePercent = (value) =>
  Number.isInteger(value) && value >= MIN_WHOLESALE_PERCENT && value <= MAX_WHOLESALE_PERCENT;

export async function getWholesalePercent(db) {
  const result = await db.query(`SELECT value FROM store_settings WHERE key = 'wholesale_percent'`);
  const value = Number(result.rows[0]?.value);
  return isValidWholesalePercent(value) ? value : DEFAULT_WHOLESALE_PERCENT;
}

export async function setWholesalePercent(db, percent) {
  await db.query(
    `INSERT INTO store_settings (key, value) VALUES ('wholesale_percent', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(percent)]
  );
}

// Porcentaje del usuario si es mayorista; null si no lo es
export async function wholesalePercentFor(db, userId) {
  if (!userId) return null;
  const result = await db.query(
    `SELECT r.nombre AS role FROM users u JOIN rol r ON r.id_rol = u.role WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0]?.role === WHOLESALE_ROLE ? getWholesalePercent(db) : null;
}

// Igual que los cupones: el cobro nunca baja de Q5 (mínimo de Recurrente)
export const wholesaleDiscountCents = (subtotalCents, percent) =>
  Math.max(0, Math.min(Math.round((subtotalCents * percent) / 100), subtotalCents - MIN_CHARGE_CENTS));
