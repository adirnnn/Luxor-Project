// SFTWRKEY-419: estados del pedido, con su nombre en español y el color de su etiqueta.
// Son los mismos de backend/services/orderStatus.js.
export const ORDER_STATUSES = ["pagado", "en_preparacion", "enviado", "entregado", "cancelado"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    pagado: "Pagado",
    en_preparacion: "En preparación",
    enviado: "Enviado",
    entregado: "Entregado",
    cancelado: "Cancelado",
};

// Psicología del color (feedback del cliente): cada estado dice qué tiene que hacer el admin.
// pagado = naranja, pedido nuevo que hay que preparar ya; en preparación = azul, trabajo en curso;
// enviado = violeta, va en camino; entregado = verde, terminado; cancelado = rojo, detenido.
export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
    pagado: "bg-status-attention-bg text-status-attention border-status-attention/40",
    en_preparacion: "bg-status-info-bg text-status-info border-status-info/40",
    enviado: "bg-status-transit-bg text-status-transit border-status-transit/40",
    entregado: "bg-status-success-bg text-status-success border-status-success/40",
    cancelado: "bg-status-error-bg text-status-error border-status-error/40",
};

// borde de color a la izquierda de cada pedido en la lista del admin
export const ORDER_STATUS_ACCENTS: Record<OrderStatus, string> = {
    pagado: "border-l-status-attention",
    en_preparacion: "border-l-status-info",
    enviado: "border-l-status-transit",
    entregado: "border-l-status-success",
    cancelado: "border-l-status-error",
};

export const statusAccent = (status: string) => ORDER_STATUS_ACCENTS[status as OrderStatus] ?? "border-l-white/20";

// para estados que no esten en la lista (no deberia pasar)
export const statusLabel = (status: string) => ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
export const statusStyle = (status: string) =>
    ORDER_STATUS_STYLES[status as OrderStatus] ?? "bg-white/10 text-white/70 border-white/20";
