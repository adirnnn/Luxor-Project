import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { PageTitle, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PageMeta } from "../components/seo/PageMeta";
import { fetchAdminReviews, setReviewHidden } from "../services/reviewService";
import type { AdminReview, ReviewFilters } from "../services/reviewService";
import { friendlyError } from "../services/apiClient";
import { Stars } from "../features/reviews/StarRating";
import { formatRating, reviewCountLabel } from "../features/reviews/rating";

// SFTWRKEY-431: el admin revisa las reseñas y oculta (o vuelve a mostrar) las que no deben publicarse.
// Al cambiar una, el backend recalcula el promedio del perfume en la misma transacción.
const PAGE_SIZE = 20;

const inputClass =
    "w-full h-10 bg-white/10 rounded-lg px-3 py-2 text-primary-champagne text-xs focus:outline-none focus:ring-2 focus:ring-primary-gold [color-scheme:dark]";
const labelClass = "flex flex-col gap-2 text-xs text-primary-champagne/70 uppercase tracking-widest";

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });

type Status = NonNullable<ReviewFilters["status"]>;

export default function AdminReviewsPage() {
    const navigate = useNavigate();
    const [reviews, setReviews] = useState<AdminReview[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<Status>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const loadReviews = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchAdminReviews({ status, page, limit: PAGE_SIZE });
            setReviews(data.reviews);
            setTotal(data.total);
        } catch (e) {
            setError(friendlyError(e, "Error al cargar las reseñas."));
        } finally {
            setLoading(false);
        }
    }, [status, page]);

    useEffect(() => {
        void loadReviews();
    }, [loadReviews]);

    const toggle = async (review: AdminReview) => {
        const hidden = !review.hidden;
        setSavingId(review.id);
        setMessage(null);
        try {
            const { rating } = await setReviewHidden(review.id, hidden);
            setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, hidden } : r)));
            const promedio = rating.average === null || rating.count === 0
                ? "ya no tiene reseñas visibles"
                : `queda en ${formatRating(rating.average)} (${reviewCountLabel(rating.count)})`;
            setMessage({
                type: "success",
                text: `Reseña ${hidden ? "oculta" : "visible de nuevo"}. El promedio de ${review.product_name} ${promedio}.`,
            });
        } catch (e) {
            setMessage({ type: "error", text: friendlyError(e, "No se pudo actualizar la reseña.") });
        } finally {
            setSavingId(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <MainLayout>
            <PageMeta title="Reseñas" noindex />
            <Section className="min-h-screen pt-0 pb-20">
                <Container>
                    <div className="flex flex-col gap-10">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                            <div className="flex flex-col gap-2">
                                <PageTitle className="mb-2">Reseñas</PageTitle>
                                <Text className="text-primary-champagne/40 font-black uppercase tracking-[0.3em] text-xs italic">Opiniones de los clientes</Text>
                            </div>
                            <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => navigate("/admin")}>Volver al panel</Button>
                        </div>

                        <div className="glass-card p-6 md:p-8 border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <label className={labelClass}>
                                Mostrar
                                <select
                                    value={status}
                                    onChange={(e) => { setStatus(e.target.value as Status); setPage(1); }}
                                    className={inputClass}
                                >
                                    <option value="" className="text-black">Todas</option>
                                    <option value="visible" className="text-black">Visibles</option>
                                    <option value="hidden" className="text-black">Ocultas</option>
                                </select>
                            </label>
                        </div>

                        {message && (
                            <p role="status" className={`text-sm ${message.type === "success" ? "text-status-success" : "text-status-error"}`}>
                                {message.text}
                            </p>
                        )}

                        {loading ? (
                            <LoadingSpinner message="Cargando reseñas..." />
                        ) : error ? (
                            <div className="flex flex-col items-center">
                                <ErrorMessage message={error} />
                                <Button onClick={() => void loadReviews()} variant="outline" className="-mt-20 px-12">Reintentar</Button>
                            </div>
                        ) : reviews.length === 0 ? (
                            <div className="glass-card p-12 border-white/5 text-center">
                                <Text className="text-primary-champagne/50">
                                    {status ? "No hay reseñas con este filtro." : "Aún no hay reseñas."}
                                </Text>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                <ul className="flex flex-col gap-4">
                                    {reviews.map((review) => (
                                        <li
                                            key={review.id}
                                            className={`glass-card border-white/5 p-5 md:p-6 flex flex-col gap-3 ${review.hidden ? "opacity-60" : ""}`}
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex flex-wrap items-center gap-3 min-w-0">
                                                    <Link
                                                        to={`/producto/${review.product_id}`}
                                                        className="font-bold text-primary-champagne hover:text-primary-gold truncate"
                                                    >
                                                        {review.product_name}
                                                    </Link>
                                                    <Stars value={review.rating} size="sm" />
                                                    {review.hidden && (
                                                        <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border bg-status-error-bg text-status-error border-status-error/30">
                                                            Oculta
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => void toggle(review)}
                                                    disabled={savingId === review.id}
                                                    className="h-9 border border-primary-gold text-primary-gold rounded-lg px-4 text-[10px] uppercase tracking-widest hover:bg-primary-gold hover:text-primary-black transition-colors disabled:opacity-40"
                                                >
                                                    {savingId === review.id ? "Guardando..." : review.hidden ? "Mostrar" : "Ocultar"}
                                                </button>
                                            </div>

                                            {review.comment ? (
                                                <p className="text-sm text-primary-champagne/80 whitespace-pre-line break-words">{review.comment}</p>
                                            ) : (
                                                <p className="text-sm italic text-primary-champagne/40">Sin comentario</p>
                                            )}

                                            <p className="text-xs text-primary-champagne/40">
                                                {review.user_name ?? "Cliente"}
                                                {review.user_email && ` · ${review.user_email}`} · Pedido #{review.order_id} · {formatDate(review.created_at)}
                                            </p>
                                        </li>
                                    ))}
                                </ul>

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-xs text-primary-champagne/50 uppercase tracking-widest">
                                        Página {page} de {totalPages} · {total} {total === 1 ? "reseña" : "reseñas"}
                                    </p>
                                    <div className="flex gap-3">
                                        <Button variant="outline" className="px-6 py-3 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                                        <Button variant="outline" className="px-6 py-3 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}
