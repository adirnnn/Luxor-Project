import { API_URL } from "./apiClient";
import type { Delivery } from "../utils/shipping";

export interface OrderConfirmation {
    order: {
        id: number;
        total: number;
        status: string;
        created_at: string;
        items: {
        product_id: string;
        name: string;
        quantity: number;
        unit_price: number;
        subtotal: number;
        }[];
        // SFTWRKEY-449: envío y forma de entrega
        shipping: number;
        delivery: Delivery | null;
    };
    payment: {
        brand: string | null;
        last4: string | null;
    } | null;
    }

    export async function fetchOrderConfirmation(
    id: string,
    signal?: AbortSignal
    ): Promise<OrderConfirmation> {
    const res = await fetch(
        `${API_URL}/orders/${encodeURIComponent(id)}/confirmation`,
        {
        cache: "no-store",
        signal,
        }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
        throw new Error(
        data?.message || "No se pudo consultar la confirmación de compra."
        );
    }

    return data;
}