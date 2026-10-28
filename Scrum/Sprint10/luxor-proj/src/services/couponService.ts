// SFTWRKEY-432: cupones de descuento. El navegador solo manda el código; el descuento que se
// cobra lo calcula el backend al abrir el pago (lo de aquí es para mostrarlo antes).
import { API_URL } from "./apiClient";

export type DiscountType = "porcentaje" | "monto";

export type PublicCoupon = {
    code: string;
    discount_type: DiscountType;
    value: number;
    min_purchase: number;
};

export type CouponState = "activo" | "vencido" | "agotado" | "desactivado";

export type AdminCoupon = PublicCoupon & {
    id: number;
    max_uses: number | null;
    expires_at: string;
    active: boolean;
    created_at: string;
    used: number;
    reserved: number;
    total_discount: number;
    state: CouponState;
};

export type NewCoupon = {
    code: string;
    discount_type: DiscountType;
    value: string;
    min_purchase: string;
    max_uses: string;
    expires_at: string;
};

export type CartLine = { product_id: string; quantity: number };

// SFTWRKEY-451: la sesión va en la cookie, el navegador la manda sola
async function getJson(path: string, errorMessage: string, init?: RequestInit) {
    const res = await fetch(`${API_URL}${path}`, init);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(body?.message || errorMessage);
    }
    return body;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

export async function validateCoupon(code: string, items: CartLine[]): Promise<PublicCoupon> {
    const data = await getJson("/coupons/validate", "No se pudo revisar el cupón", jsonInit("POST", { code, items }));
    return data.coupon;
}

export async function fetchAdminCoupons(): Promise<AdminCoupon[]> {
    const data = await getJson("/admin/coupons", "Error al obtener los cupones");
    return Array.isArray(data?.coupons) ? data.coupons : [];
}

export async function createCoupon(input: NewCoupon): Promise<AdminCoupon> {
    const data = await getJson(
        "/admin/coupons",
        "No se pudo crear el cupón",
        jsonInit("POST", {
            code: input.code,
            discount_type: input.discount_type,
            value: input.value,
            min_purchase: input.min_purchase || 0,
            max_uses: input.max_uses ? Number(input.max_uses) : null,
            expires_at: input.expires_at,
        }),
    );
    return data.coupon;
}

export async function setCouponActive(id: number, active: boolean): Promise<AdminCoupon> {
    const data = await getJson(`/admin/coupons/${id}`, "No se pudo actualizar el cupón", jsonInit("PATCH", { active }));
    return data.coupon;
}
