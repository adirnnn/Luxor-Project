// SFTWRKEY-432: cálculo del descuento para MOSTRARLO en el carrito y el pago. Es la misma fórmula de
// backend/services/coupons.js, pero el cobro siempre lo calcula el servidor: si no coinciden, manda él.
import type { PublicCoupon } from "../../services/couponService";
import { formatPrice } from "../../utils/formatPrice";

// Recurrente no cobra menos de Q5: el descuento nunca deja los productos por debajo
const MIN_CHARGE_CENTS = 500;

// cupón aplicado en esta pestaña (carrito → pago → pago de invitado)
const STORAGE_KEY = "luxor-cupon";

// descuento en quetzales para un subtotal de productos en quetzales
export function discountFor(coupon: PublicCoupon | null, subtotal: number): number {
    if (!coupon) return 0;
    const subtotalCents = Math.round(subtotal * 100);
    if (subtotalCents < Math.round(coupon.min_purchase * 100)) return 0;
    const raw =
        coupon.discount_type === "porcentaje"
            ? Math.round((subtotalCents * coupon.value) / 100)
            : Math.round(coupon.value * 100);
    return Math.max(0, Math.min(raw, subtotalCents - MIN_CHARGE_CENTS)) / 100;
}

export const couponLabel = (coupon: PublicCoupon) =>
    coupon.discount_type === "porcentaje" ? `${coupon.value}% de descuento` : `${formatPrice(coupon.value)} de descuento`;

export function readStoredCoupon(): PublicCoupon | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const coupon = JSON.parse(raw) as PublicCoupon;
        return typeof coupon?.code === "string" ? coupon : null;
    } catch {
        return null;
    }
}

export function storeCoupon(coupon: PublicCoupon | null) {
    try {
        if (coupon) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coupon));
        else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // sin sessionStorage (modo privado): el cupón dura solo en esta página
    }
}
