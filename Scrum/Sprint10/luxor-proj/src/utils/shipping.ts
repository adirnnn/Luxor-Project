import { useEffect, useState } from "react";
import { API_URL } from "../services/apiClient";
import { formatPrice } from "./formatPrice";

// SFTWRKEY-449: envío a domicilio Q35, gratis desde Q500 en productos, o recoger en tienda gratis.
// La regla vive en backend/services/shipping.js; aquí solo se muestra. El cobro siempre lo
// calcula el servidor, así que si estos números no coinciden manda lo del servidor.

export type DeliveryMethod = "envio" | "recoger";

export type PickupStore = { id: string; name: string; address: string };

export type ShippingAddress = { billingAddress: string; city: string; postalCode: string; country: string };

export type Delivery =
    | { method: "envio"; address: ShippingAddress }
    | { method: "recoger"; store: PickupStore };

export type ShippingOptions = { flatCents: number; freeFromCents: number; stores: PickupStore[] };

// los mismos valores del backend, por si GET /shipping no responde
export const DEFAULT_SHIPPING: ShippingOptions = {
    flatCents: 3500,
    freeFromCents: 50000,
    stores: [
        { id: "victoria", name: "Joyería Victoria", address: "Metro Centro, 19 calle 3-31, Zona 1" },
        { id: "glamour", name: "Joyería Glamour", address: "C.C. El Pueblito, Zona 1" },
        { id: "luxor", name: "Joyería Luxor", address: "C.C. San Isidro, Zona 16" },
    ],
};

// costo de envío en quetzales para un subtotal en quetzales
export function shippingFor(subtotal: number, method: DeliveryMethod, options: ShippingOptions = DEFAULT_SHIPPING) {
    if (method === "recoger") return 0;
    return Math.round(subtotal * 100) >= options.freeFromCents ? 0 : options.flatCents / 100;
}

export const shippingLabel = (amount: number) => (amount > 0 ? formatPrice(amount) : "Gratis");

export const freeShippingHint = (options: ShippingOptions = DEFAULT_SHIPPING) =>
    `Envío gratis desde ${formatPrice(options.freeFromCents / 100)}`;

// texto de la entrega para el cliente y el admin
export function describeDelivery(delivery: Delivery | null | undefined): string | null {
    if (!delivery) return null;
    if (delivery.method === "recoger") return `Recoger en ${delivery.store.name}, ${delivery.store.address}`;
    const a = delivery.address;
    return `Envío a ${a.billingAddress}, ${a.city}, ${a.postalCode}, ${a.country}`;
}

export function useShippingOptions(): ShippingOptions {
    const [options, setOptions] = useState<ShippingOptions>(DEFAULT_SHIPPING);
    useEffect(() => {
        let cancelado = false;
        fetch(`${API_URL}/shipping`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data: ShippingOptions | null) => {
                if (!cancelado && data?.stores?.length) setOptions(data);
            })
            .catch(() => {});
        return () => {
            cancelado = true;
        };
    }, []);
    return options;
}
