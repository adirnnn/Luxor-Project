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

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
    pagado: "bg-status-info-bg text-status-info border-status-info/30",
    en_preparacion: "bg-status-warning-bg text-status-warning border-status-warning/30",
    enviado: "bg-status-warning-bg text-status-warning border-status-warning/30",
    entregado: "bg-status-success-bg text-status-success border-status-success/30",
    cancelado: "bg-status-error-bg text-status-error border-status-error/30",
};

// para estados que no esten en la lista (no deberia pasar)
export const statusLabel = (status: string) => ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
export const statusStyle = (status: string) =>
    ORDER_STATUS_STYLES[status as OrderStatus] ?? "bg-white/10 text-white/70 border-white/20";
