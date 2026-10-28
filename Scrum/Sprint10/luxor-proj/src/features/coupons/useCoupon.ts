import { useState } from "react";
import { validateCoupon, type CartLine, type PublicCoupon } from "../../services/couponService";
import { friendlyError } from "../../services/apiClient";
import { discountFor, readStoredCoupon, storeCoupon } from "./coupon";

// SFTWRKEY-432: cupón aplicado en el carrito, el pago o el pago de invitado. Se guarda en la pestaña
// para que el que se aplicó en el carrito siga al pasar a pagar. El backend lo vuelve a validar al
// abrir el pago, así que aquí solo se muestra el descuento.
export function useCoupon(items: CartLine[], subtotal: number) {
    const [coupon, setCoupon] = useState<PublicCoupon | null>(readStoredCoupon);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);

    const apply = async (code: string) => {
        const clean = code.trim();
        if (!clean) {
            setError("Escribe el código del cupón.");
            return;
        }
        setChecking(true);
        setError(null);
        try {
            const valid = await validateCoupon(clean, items);
            setCoupon(valid);
            storeCoupon(valid);
        } catch (err) {
            setError(friendlyError(err, "No se pudo revisar el cupón."));
        } finally {
            setChecking(false);
        }
    };

    const remove = () => {
        setCoupon(null);
        setError(null);
        storeCoupon(null);
    };

    const discount = discountFor(coupon, subtotal);
    // el carrito cambió y ya no llega a la compra mínima del cupón
    const belowMinimum = coupon !== null && Math.round(subtotal * 100) < Math.round(coupon.min_purchase * 100);

    return { coupon, discount, belowMinimum, error, checking, apply, remove, setError };
}
