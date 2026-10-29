import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H3, PageTitle, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PageMeta } from "../components/seo/PageMeta";
import { ORDER_STATUSES, statusAccent, statusLabel, statusStyle } from "../constants/orderStatus";
import { fetchAdminOrder, fetchAdminOrders, updateOrderStatus } from "../services/orderService";
import type { AdminOrder, AdminOrderDetail } from "../services/orderService";
import { friendlyError } from "../services/apiClient";
import { formatPrice } from "../utils/formatPrice";
import { shippingLabel } from "../utils/shipping";

// SFTWRKEY-419: pedidos del admin, con filtros, paginacion y cambio de estado
const PAGE_SIZE = 20;

const inputClass =
    "w-full h-10 bg-white/10 rounded-lg px-3 py-2 text-primary-champagne text-xs focus:outline-none focus:ring-2 focus:ring-primary-gold [color-scheme:dark]";
const labelClass = "flex flex-col gap-2 text-xs text-primary-champagne/70 uppercase tracking-widest";

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });
const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("es-GT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const formatMoney = (value: number) => formatPrice(value);
const unidadesQueVuelven = (n: number) =>
    n === 1 ? "la unidad de este pedido vuelve al stock" : `las ${n} unidades de este pedido vuelven al stock`;

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-block whitespace-nowrap text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${statusStyle(status)}`}>
            {statusLabel(status)}
        </span>
    );
}

export default function AdminOrdersPage() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<AdminOrder[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchAdminOrders({ status, from, to, page, limit: PAGE_SIZE });
            setOrders(data.orders);
            setTotal(data.total);
        } catch (e) {
            setError(friendlyError(e, "Error al cargar los pedidos."));
        } finally {
            setLoading(false);
        }
    }, [status, from, to, page]);

    useEffect(() => {
        void loadOrders();
    }, [loadOrders]);

    // al cambiar un filtro se vuelve a la primera pagina
    const changeFilter = (setter: (value: string) => void) => (value: string) => {
        setter(value);
        setPage(1);
    };

    const clearFilters = () => {
        setStatus("");
        setFrom("");
        setTo("");
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const hasFilters = status !== "" || from !== "" || to !== "";

    return (
        <MainLayout>
            <PageMeta title="Pedidos" noindex />
            <Section className="min-h-screen pt-0 pb-20">
                <Container>
                    <div className="flex flex-col gap-10">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                            <div className="flex flex-col gap-2">
                                <PageTitle className="mb-2">Pedidos</PageTitle>
                                <Text className="text-primary-champagne/40 font-black uppercase tracking-[0.3em] text-xs italic">Seguimiento y estado de las compras</Text>
                            </div>
                            <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => navigate("/admin")}>Volver al panel</Button>
                        </div>

                        <div className="glass-card p-6 md:p-8 border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <label className={labelClass}>
                                Estado
                                <select value={status} onChange={(e) => changeFilter(setStatus)(e.target.value)} className={inputClass}>
                                    <option value="" className="text-black">Todos</option>
                                    {ORDER_STATUSES.map((s) => (
                                        <option key={s} value={s} className="text-black">{statusLabel(s)}</option>
                                    ))}
                                </select>
                            </label>
                            <label className={labelClass}>
                                Desde
                                <input type="date" value={from} max={to || undefined} onChange={(e) => changeFilter(setFrom)(e.target.value)} className={inputClass} />
                            </label>
                            <label className={labelClass}>
                                Hasta
                                <input type="date" value={to} min={from || undefined} onChange={(e) => changeFilter(setTo)(e.target.value)} className={inputClass} />
                            </label>
                            <button
                                onClick={clearFilters}
                                disabled={!hasFilters}
                                className="h-10 border border-primary-gold text-primary-gold rounded-lg px-4 py-2 text-xs uppercase tracking-widest hover:bg-primary-gold hover:text-primary-black transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-primary-gold"
                            >
                                Limpiar filtros
                            </button>
                        </div>

                        {loading ? (
                            <LoadingSpinner message="Cargando pedidos..." />
                        ) : error ? (
                            <div className="flex flex-col items-center">
                                <ErrorMessage message={error} />
                                <Button onClick={() => void loadOrders()} variant="outline" className="-mt-20 px-12">Reintentar</Button>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="glass-card p-12 border-white/5 text-center">
                                <Text className="text-primary-champagne/50">
                                    {hasFilters ? "No hay pedidos con estos filtros." : "Aún no hay pedidos registrados."}
                                </Text>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                {/* en celular y tablet cada pedido es una tarjeta */}
                                <ul className="lg:hidden flex flex-col gap-4">
                                    {orders.map((order) => (
                                        <li key={order.id}>
                                            <button
                                                onClick={() => setSelectedId(order.id)}
                                                className={`w-full glass-card border-white/5 border-l-4 ${statusAccent(order.status)} p-5 flex flex-col gap-3 text-left active:bg-white/[0.03]`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="font-bold text-primary-champagne">Pedido #{order.id}</span>
                                                    <StatusBadge status={order.status} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-sm truncate ${order.is_guest ? "italic text-primary-champagne/70" : "text-primary-champagne"}`}>{order.customer_name}</p>
                                                    <p className="text-xs text-primary-champagne/40">
                                                        {formatDate(order.created_at)} · {order.items_count} {order.items_count === 1 ? "producto" : "productos"}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-primary-gold">{formatMoney(order.total)}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold">Ver detalle</span>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>

                                <div className="hidden lg:block glass-card border-white/5 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[760px] text-left text-sm">
                                            <thead className="text-[10px] uppercase tracking-[0.2em] text-primary-champagne/40">
                                                <tr>
                                                    <th className="px-6 py-4 font-black">Pedido</th>
                                                    <th className="px-6 py-4 font-black">Cliente</th>
                                                    <th className="px-6 py-4 font-black">Fecha</th>
                                                    <th className="px-6 py-4 font-black">Productos</th>
                                                    <th className="px-6 py-4 font-black">Total</th>
                                                    <th className="px-6 py-4 font-black">Estado</th>
                                                    <th className="px-6 py-4"><span className="sr-only">Acciones</span></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {orders.map((order) => (
                                                    <tr
                                                        key={order.id}
                                                        onClick={() => setSelectedId(order.id)}
                                                        className="border-t border-white/5 text-primary-champagne hover:bg-white/[0.03] cursor-pointer transition-colors"
                                                    >
                                                        {/* el borde de color indica de un vistazo qué pedidos requieren acción */}
                                                        <td className={`px-6 py-4 font-bold border-l-4 ${statusAccent(order.status)}`}>#{order.id}</td>
                                                        <td className="px-6 py-4">
                                                            <p className={order.is_guest ? "italic text-primary-champagne/70" : ""}>{order.customer_name}</p>
                                                            {order.customer_email && <p className="text-xs text-primary-champagne/40">{order.customer_email}</p>}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-primary-champagne/70">{formatDate(order.created_at)}</td>
                                                        <td className="px-6 py-4 text-primary-champagne/70">{order.items_count}</td>
                                                        <td className="px-6 py-4 font-bold text-primary-gold whitespace-nowrap">{formatMoney(order.total)}</td>
                                                        <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSelectedId(order.id); }}
                                                                className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold hover:text-primary-champagne transition-colors"
                                                            >
                                                                Ver detalle
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-xs text-primary-champagne/50 uppercase tracking-widest">
                                        {totalPages > 1 && `Página ${page} de ${totalPages} · `}{total} {total === 1 ? "pedido" : "pedidos"}
                                    </p>
                                    {/* sin más páginas no se muestran Anterior y Siguiente (feedback del cliente) */}
                                    {totalPages > 1 && (
                                    <div className="flex gap-3">
                                        <Button variant="outline" className="px-6 py-3 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                                        <Button variant="outline" className="px-6 py-3 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
                                    </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Container>
            </Section>

            {selectedId !== null && (
                <OrderDetailPanel
                    orderId={selectedId}
                    onClose={() => setSelectedId(null)}
                    onStatusChanged={() => void loadOrders()}
                />
            )}
        </MainLayout>
    );
}

type DetailProps = {
    orderId: number;
    onClose: () => void;
    onStatusChanged: () => void;
};

function OrderDetailPanel({ orderId, onClose, onStatusChanged }: DetailProps) {
    const [order, setOrder] = useState<AdminOrderDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [nextStatus, setNextStatus] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const loadOrder = useCallback(() => {
        fetchAdminOrder(orderId)
            .then((data) => { setOrder(data); setError(null); })
            .catch((e) => setError(friendlyError(e, "Error al cargar el pedido.")));
    }, [orderId]);

    useEffect(() => {
        loadOrder();
    }, [loadOrder]);

    // cerrar con Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const units = order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

    const handleUpdate = async () => {
        if (!order || !nextStatus) return;
        if (nextStatus === "cancelado" &&
            !confirm(`¿Seguro que quieres cancelar el pedido #${order.id}? Al cancelarlo, ${unidadesQueVuelven(units)} y no se puede deshacer.`)) {
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            await updateOrderStatus(order.id, nextStatus);
            setMessage({ type: "success", text: `Estado actualizado a "${statusLabel(nextStatus)}".` });
            setNextStatus("");
            loadOrder();
            onStatusChanged();
        } catch (e) {
            setMessage({ type: "error", text: e instanceof Error ? e.message : "No se pudo actualizar el estado." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="detalle-pedido-titulo"
                onClick={(e) => e.stopPropagation()}
                className="glass-card bg-primary-black/95 border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-10 flex flex-col gap-8"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col items-start gap-2">
                        <H3 className="text-2xl md:text-3xl font-light text-primary-champagne" >
                            <span id="detalle-pedido-titulo">Pedido #{orderId}</span>
                        </H3>
                        {order && <StatusBadge status={order.status} />}
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-white/10 text-primary-champagne/60 hover:text-primary-gold hover:border-primary-gold/30 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {error ? (
                    <ErrorMessage message={error} />
                ) : !order ? (
                    <LoadingSpinner message="Cargando pedido..." />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold">Cliente</span>
                                <span className="text-primary-champagne">{order.customer_name}</span>
                                {order.customer_email && <span className="text-xs text-primary-champagne/50">{order.customer_email}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold">Fecha</span>
                                <span className="text-primary-champagne">{formatDateTime(order.created_at)}</span>
                            </div>
                            {/* SFTWRKEY-449: a dónde enviar o en qué local lo recoge (con y sin cuenta) */}
                            <div className="flex flex-col gap-1 sm:col-span-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold">
                                    {order.delivery?.method === "recoger" ? "Recoge en tienda" : "Dirección de entrega"}
                                </span>
                                <span className="text-primary-champagne">
                                    {order.delivery?.method === "recoger"
                                        ? `${order.delivery.store.name}, ${order.delivery.store.address}`
                                        : order.delivery
                                            ? `${order.delivery.address.billingAddress}, ${order.delivery.address.city}, ${order.delivery.address.postalCode}, ${order.delivery.address.country}`
                                            : "Sin datos de entrega (pedido anterior a los envíos)"}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold">Productos</span>
                            <ul className="flex flex-col divide-y divide-white/5">
                                {order.items.map((item, index) => (
                                    <li key={`${item.product_id}-${index}`} className="flex items-center gap-4 py-3">
                                        <div className="w-12 h-12 shrink-0 rounded-xl bg-primary-black/40 border border-white/5 overflow-hidden">
                                            {item.image && <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-primary-champagne truncate">{item.name}</p>
                                            <p className="text-xs text-primary-champagne/50">{item.quantity} × {formatMoney(item.unit_price)}</p>
                                        </div>
                                        <span className="text-sm text-primary-champagne/80 whitespace-nowrap">{formatMoney(item.subtotal)}</span>
                                    </li>
                                ))}
                            </ul>
                            {(order.discount ?? 0) > 0 && (
                              <div className="flex justify-between border-t border-white/10 pt-3 text-sm">
                                <span className="text-primary-champagne/60">Descuento{order.discount_label ? ` (${order.discount_label})` : ""}</span>
                                <span className="text-status-success">−{formatMoney(order.discount ?? 0)}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-white/10 pt-3 text-sm">
                                <span className="text-primary-champagne/60">{order.delivery?.method === "recoger" ? "Recoger en tienda" : "Envío"}</span>
                                <span className="text-primary-champagne/80">{shippingLabel(order.shipping ?? 0)}</span>
                            </div>
                            <div className="flex justify-between border-t border-white/10 pt-3">
                                <span className="text-xs uppercase tracking-widest text-primary-champagne/60">Total</span>
                                <span className="font-bold text-primary-gold">{formatMoney(order.total)}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold">Historial</span>
                            <ol className="flex flex-col gap-3 border-l border-white/10 ml-1">
                                {order.history.map((h, index) => (
                                    <li key={index} className="relative pl-5">
                                        <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary-gold" />
                                        <p className="text-sm text-primary-champagne">
                                            {h.from_status ? `${statusLabel(h.from_status)} → ${statusLabel(h.to_status)}` : statusLabel(h.to_status)}
                                        </p>
                                        <p className="text-xs text-primary-champagne/50">
                                            {formatDateTime(h.changed_at)}{h.changed_by_name ? ` · ${h.changed_by_name}` : ""}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        </div>

                        <div className="flex flex-col gap-4 border-t border-white/10 pt-6">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold">Cambiar estado</span>
                            {order.allowedNextStatuses.length === 0 ? (
                                <p className="text-sm text-primary-champagne/50">
                                    Este pedido está {statusLabel(order.status).toLowerCase()} y ya no se puede cambiar.
                                </p>
                            ) : (
                                <>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <label className="flex-1">
                                            <span className="sr-only">Nuevo estado</span>
                                            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className={inputClass}>
                                                <option value="" className="text-black">Selecciona el nuevo estado</option>
                                                {order.allowedNextStatuses.map((s) => (
                                                    <option key={s} value={s} className="text-black">{statusLabel(s)}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <button
                                            onClick={() => void handleUpdate()}
                                            disabled={!nextStatus || saving}
                                            className="border border-primary-gold text-primary-gold rounded-lg px-4 py-2 text-xs uppercase tracking-widest hover:bg-primary-gold hover:text-primary-black transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-primary-gold"
                                        >
                                            {saving ? "Guardando..." : "Actualizar estado"}
                                        </button>
                                    </div>
                                    {nextStatus === "cancelado" && (
                                        <p className="text-xs text-status-warning">
                                            Al cancelar, {unidadesQueVuelven(units)}.
                                        </p>
                                    )}
                                </>
                            )}
                            {message && (
                                <p role="status" className={`text-sm ${message.type === "success" ? "text-status-success" : "text-status-error"}`}>
                                    {message.text}
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
