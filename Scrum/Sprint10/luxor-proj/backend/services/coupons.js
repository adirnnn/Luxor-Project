export const COUPON_CODE_REGEX = /^[A-Z0-9_-]{3,30}$/;
export const DISCOUNT_TYPES = ['porcentaje', 'monto'];

// Recurrente no cobra menos de Q5 (igual que reserveStock): el descuento nunca baja los productos de ahí
export const MIN_CHARGE_CENTS = 500;

// usos que cuentan para el límite: los apartados en un pago abierto y los ya cobrados
const COUNTED_STATUSES = `('reservado', 'usado')`;

// "  verano10 " -> "VERANO10"; null si no tiene el formato de un código
export function normalizeCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return COUPON_CODE_REGEX.test(code) ? code : null;
}

export const couponError = (code, message, status = 400) =>
  Object.assign(new Error(message), { status, code });

const quetzales = (cents) =>
  `Q${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Descuento en centavos para un subtotal de productos en centavos
export function discountCents(coupon, subtotalCents) {
  const value = Number(coupon.value);
  const raw =
    coupon.discount_type === 'porcentaje'
      ? Math.round((subtotalCents * value) / 100)
      : Math.round(value * 100);
  return Math.max(0, Math.min(raw, subtotalCents - MIN_CHARGE_CENTS));
}

export async function findUsableCoupon(db, { code, subtotalCents, userId = null, guestEmail = null, lock = false }) {
  const normalized = normalizeCode(code);
  if (!normalized) throw couponError('COUPON_NOT_FOUND', 'Este cupón no existe o ya no está disponible.');

  const coupon = (
    await db.query(
      `SELECT id, code, discount_type, value, min_purchase, max_uses, expires_at, active
       FROM coupons WHERE code = $1${lock ? ' FOR UPDATE' : ''}`,
      [normalized]
    )
  ).rows[0];

  // mismo mensaje si no existe o si el admin lo desactivó
  if (!coupon || !coupon.active) {
    throw couponError('COUPON_NOT_FOUND', 'Este cupón no existe o ya no está disponible.');
  }
  if (new Date(coupon.expires_at).getTime() <= Date.now()) {
    throw couponError('COUPON_EXPIRED', 'Este cupón ya venció.');
  }

  const email = typeof guestEmail === 'string' && guestEmail.trim() ? guestEmail.trim().toLowerCase() : null;
  const usage = (
    await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (
                WHERE ($2::int IS NOT NULL AND user_id = $2)
                   OR ($3::text IS NOT NULL AND lower(guest_email) = $3)
              )::int AS mine
       FROM coupon_uses
       WHERE coupon_id = $1 AND status IN ${COUNTED_STATUSES}`,
      [coupon.id, userId ?? null, email]
    )
  ).rows[0] ?? { total: 0, mine: 0 };

  if (coupon.max_uses != null && usage.total >= coupon.max_uses) {
    throw couponError('COUPON_EXHAUSTED', 'Este cupón ya alcanzó su límite de usos.');
  }
  if (usage.mine > 0) {
    throw couponError('COUPON_ALREADY_USED', 'Ya usaste este cupón en otra compra.');
  }

  const minCents = Math.round(Number(coupon.min_purchase) * 100);
  if (subtotalCents < minCents) {
    throw couponError('COUPON_MIN_PURCHASE', `Este cupón es para compras desde ${quetzales(minCents)} en productos.`);
  }

  const discount = discountCents(coupon, subtotalCents);
  if (discount <= 0) {
    throw couponError('COUPON_MIN_PURCHASE', 'El total de tu compra es muy bajo para aplicar este cupón.');
  }
  return { coupon, discountCents: discount };
}

// Aparta el uso dentro de la transacción que abrió el pago (después de findUsableCoupon con lock)
export async function reserveCouponUse(db, { couponId, sessionId, userId = null, guestEmail = null, discountCents: cents }) {
  await db.query(
    `INSERT INTO coupon_uses (coupon_id, session_id, user_id, guest_email, discount)
     VALUES ($1, $2, $3, $4, $5)`,
    [couponId, sessionId, userId, guestEmail ? guestEmail.trim().toLowerCase() : null, cents / 100]
  );
}

// El pago no se hizo: el uso apartado deja de contar para el límite
export async function releaseCouponUse(db, sessionId) {
  await db.query(
    `UPDATE coupon_uses SET status = 'liberado' WHERE session_id = $1 AND status = 'reservado'`,
    [sessionId]
  );
}

// Recurrente confirmó el cobro. También si el uso ya se había liberado (pagó justo al vencer la
// sesión): el cobro con descuento ya se hizo, así que cuenta aunque el cupón quede pasado del límite.
export async function confirmCouponUse(db, sessionId, orderId) {
  await db.query(
    `UPDATE coupon_uses SET status = 'usado', order_id = $2 WHERE session_id = $1`,
    [sessionId, orderId]
  );
}

// Estado para el panel del admin
export function couponState(coupon, now = Date.now()) {
  if (!coupon.active) return 'desactivado';
  if (new Date(coupon.expires_at).getTime() <= now) return 'vencido';
  if (coupon.max_uses != null && Number(coupon.used) + Number(coupon.reserved ?? 0) >= coupon.max_uses) return 'agotado';
  return 'activo';
}
