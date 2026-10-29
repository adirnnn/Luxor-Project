// Feedback del cliente: precio de mayorista. El cobro lo calcula el servidor
// (backend/services/wholesale.js); aquí solo se muestra con la misma regla.
const MIN_CHARGE_CENTS = 500;

// descuento en quetzales para un subtotal de productos; 0 si el usuario no es mayorista
export function wholesaleDiscount(subtotal: number, percent?: number): number {
    if (!percent) return 0;
    const cents = Math.round(subtotal * 100);
    return Math.max(0, Math.min(Math.round((cents * percent) / 100), cents - MIN_CHARGE_CENTS)) / 100;
}

export const wholesaleLabel = (percent: number) => `Precio mayorista (${percent}% menos)`;
