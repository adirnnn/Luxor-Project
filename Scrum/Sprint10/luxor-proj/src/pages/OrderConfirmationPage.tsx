import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { PageMeta } from "../components/seo/PageMeta";
import { PageTitle } from "../components/ui/Typography";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { statusLabel, statusStyle } from "../constants/orderStatus";
import { fetchOrderConfirmation, type OrderConfirmation } from "../services/orderConfirmationService";
import { friendlyError } from "../services/apiClient";
import { formatPrice } from "../utils/formatPrice";
import { describeDelivery, shippingLabel } from "../utils/shipping";

type Result = {
    key: string;
    data: OrderConfirmation | null;
    error: string;
};

const linkStyle =
    "inline-flex justify-center rounded-button px-6 py-4 " +
    "text-xs font-black uppercase tracking-widest transition-colors " +
    "focus-visible:outline focus-visible:outline-2 " +
    "focus-visible:outline-primary-gold";

export default function OrderConfirmationPage() {
    const { orderId = "" } = useParams();
    const { user } = useAuth();

    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<Result>({
    key: "",
    data: null,
    error: "",
});

    const validId =
        /^\d+$/.test(orderId) &&
        Number.isSafeInteger(Number(orderId)) &&
        Number(orderId) > 0;

    const key = `${user?.id}:${orderId}:${attempt}`;

    useEffect(() => {
        if (!user || !validId) return;

        const controller = new AbortController();

        fetchOrderConfirmation(orderId, controller.signal)
        .then((data) => {
            if (!controller.signal.aborted) {
            setResult({ key, data, error: "" });
            }
        })
        .catch((err: unknown) => {
            if (!controller.signal.aborted) {
            setResult({
                key,
                data: null,
                error: friendlyError(
                err,
                "No se pudo consultar tu pedido."
                ),
            });
            }
        });

        return () => controller.abort();
    }, [orderId, user, validId, key]);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

const current = result.key === key ? result : null;
const error = !validId
    ? "El número de pedido no es válido."
    : current?.error;

const confirmation = current?.data;
const cancelled = confirmation?.order.status === "cancelado";

    return (
        <MainLayout>
        <PageMeta title="Confirmación de compra" noindex />

        <Container className="pb-20 px-4 md:px-6">
            {error ? (
            <section className="glass-card mx-auto max-w-xl p-6 text-center md:p-10">
                <PageTitle className="mb-5">
                No pudimos mostrar tu pedido
                </PageTitle>

                <p
                role="alert"
                className="mb-6 text-primary-champagne/80"
                >
                {error}
                </p>

                <div className="flex flex-col gap-3">
                {validId && (
                    <Button
                    onClick={() => setAttempt((value) => value + 1)}
                    >
                    Volver a consultar
                    </Button>
                )}

                <Link
                    className={`${linkStyle} text-primary-gold`}
                    to="/mi-cuenta"
                >
                    Ver mis compras
                </Link>
                </div>

                <p className="mt-5 text-sm text-primary-champagne/60">
                Si ya pagaste, revisa tus compras antes de intentar
                pagar otra vez.
                </p>
            </section>
            ) : !confirmation ? (
            <div role="status">
                <LoadingSpinner message="Consultando tu pedido…" />
            </div>
            ) : (
            <section className="glass-card mx-auto max-w-3xl border-primary-gold/20 p-6 md:p-10">
                <div className="mb-7 text-center">
                <PageTitle className="mb-4">
                    {cancelled
                    ? "Pedido cancelado"
                    : confirmation.payment
                        ? "¡Compra confirmada!"
                        : "Pedido registrado"}
                </PageTitle>

                <p className="text-primary-champagne/80">
                    {cancelled
                    ? "Este pedido figura como cancelado. Consulta su historial en Mis compras."
                    : `Gracias, ${user.name}. Aquí tienes el resumen de tu pedido.`}
                </p>
                </div>

                <dl className="mb-8 grid gap-5 rounded-2xl border border-white/10 p-5 sm:grid-cols-2">
                <div>
                    <dt className="text-sm text-primary-champagne/60">
                    Número de pedido
                    </dt>
                    <dd className="mt-1 text-xl font-bold text-primary-gold">
                    #{confirmation.order.id}
                    </dd>
                </div>

                <div>
                    <dt className="text-sm text-primary-champagne/60">
                    Fecha de compra
                    </dt>
                    <dd className="mt-1 text-primary-champagne">
                    <time dateTime={confirmation.order.created_at}>
                        {new Date(
                        confirmation.order.created_at
                        ).toLocaleString("es-GT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        })}
                    </time>
                    </dd>
                </div>

                <div>
                    <dt className="mb-2 text-sm text-primary-champagne/60">
                    Estado actual
                    </dt>
                    <dd>
                    <span
                        className={
                        "inline-block rounded-full border px-3 py-1 " +
                        "text-xs font-bold " +
                        statusStyle(confirmation.order.status)
                        }
                    >
                        {statusLabel(confirmation.order.status)}
                    </span>
                    </dd>
                </div>

                <div>
                    <dt className="text-sm text-primary-champagne/60">
                    Método de pago
                    </dt>
                    <dd className="mt-1 text-primary-champagne">
                    {confirmation.payment
                        ? `${confirmation.payment.brand || "Tarjeta"}${
                            confirmation.payment.last4
                            ? ` •••• ${confirmation.payment.last4}`
                            : ""
                        }`
                        : "Sin comprobante de pago disponible"}
                    </dd>
                </div>
                </dl>

                <h2 className="mb-4 font-heading text-xl text-primary-gold">
                Productos de tu pedido
                </h2>

                <ul className="divide-y divide-white/10">
                {confirmation.order.items.map((item, index) => (
                    <li
                    key={`${item.product_id}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                    <div className="min-w-0 flex-1">
                        <p className="break-words font-bold text-primary-champagne">
                        {item.name}
                        </p>
                        <p className="mt-1 text-sm text-primary-champagne/60">
                        {item.quantity} × {formatPrice(item.unit_price)}
                        </p>
                    </div>

                    <span className="font-bold text-primary-champagne">
                        {formatPrice(item.subtotal)}
                    </span>
                    </li>
                ))}
                </ul>

                {/* SFTWRKEY-449: envío y a dónde se entrega */}
                <div className="flex items-center justify-between gap-4 border-t border-white/10 py-4 text-sm">
                <span className="text-primary-champagne/70">
                    {confirmation.order.delivery?.method === "recoger" ? "Recoger en tienda" : "Envío"}
                </span>
                <span className="font-bold text-primary-champagne">
                    {shippingLabel(confirmation.order.shipping ?? 0)}
                </span>
                </div>
                {describeDelivery(confirmation.order.delivery) && (
                <p className="text-sm text-primary-champagne/60">
                    {describeDelivery(confirmation.order.delivery)}
                </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-4 border-t border-primary-gold/20 pt-6">
                <span className="font-bold text-primary-champagne">
                    Total del pedido
                </span>
                <span className="text-2xl font-black text-primary-gold sm:text-3xl">
                    {formatPrice(confirmation.order.total)}
                </span>
                </div>

                <p className="my-7 text-sm leading-relaxed text-primary-champagne/60">
                Guarda tu número de pedido. Puedes consultar su estado
                e historial desde Mis compras.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                    className={`${linkStyle} bg-primary-gold text-primary-black hover:bg-primary-champagne`}
                    to="/mi-cuenta"
                >
                    Ver mis compras
                </Link>

                <Link
                    className={`${linkStyle} border border-white/20 text-primary-champagne hover:bg-white/10`}
                    to="/perfumes"
                >
                    Seguir comprando
                </Link>
                </div>
            </section>
            )}
        </Container>
        </MainLayout>
    );
}