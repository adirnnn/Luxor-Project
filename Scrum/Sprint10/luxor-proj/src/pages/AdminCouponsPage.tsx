import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H3, PageTitle, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { PageMeta } from "../components/seo/PageMeta";
import { createCoupon, fetchAdminCoupons, setCouponActive } from "../services/couponService";
import type { AdminCoupon, CouponState, NewCoupon } from "../services/couponService";
import { friendlyError } from "../services/apiClient";
import { formatPrice } from "../utils/formatPrice";
import { couponLabel } from "../features/coupons/coupon";

// SFTWRKEY-432: el admin crea cupones (porcentaje o monto fijo, vencimiento, límite de usos y
// compra mínima) y los desactiva. Las reglas las vuelve a revisar el backend en cada compra.

const inputClass =
    "w-full h-10 bg-white/10 rounded-lg px-3 py-2 text-primary-champagne text-xs focus:outline-none focus:ring-2 focus:ring-primary-gold [color-scheme:dark]";
const labelClass = "flex flex-col gap-2 text-xs text-primary-champagne/70 uppercase tracking-widest";

const STATE_LABELS: Record<CouponState, string> = {
    activo: "Activo",
    vencido: "Vencido",
    agotado: "Agotado",
    desactivado: "Desactivado",
};

const STATE_STYLES: Record<CouponState, string> = {
    activo: "bg-status-success-bg text-status-success border-status-success/30",
    vencido: "bg-status-warning-bg text-status-warning border-status-warning/30",
    agotado: "bg-status-warning-bg text-status-warning border-status-warning/30",
    desactivado: "bg-status-error-bg text-status-error border-status-error/30",
};

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Guatemala" });

// hoy en Guatemala, para el mínimo del campo de fecha
const todayGuatemala = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Guatemala" });

const EMPTY: NewCoupon = { code: "", discount_type: "porcentaje", value: "", min_purchase: "", max_uses: "", expires_at: "" };

function StateBadge({ state }: { state: CouponState }) {
    return (
        <span className={`inline-block whitespace-nowrap text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${STATE_STYLES[state]}`}>
            {STATE_LABELS[state]}
        </span>
    );
}

const usesLabel = (c: AdminCoupon) => {
    const used = c.max_uses === null ? `${c.used} usos` : `${c.used} de ${c.max_uses} usos`;
    return c.reserved > 0 ? `${used} · ${c.reserved} en un pago abierto` : used;
};

export default function AdminCouponsPage() {
    const navigate = useNavigate();
    const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<NewCoupon>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const loadCoupons = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setCoupons(await fetchAdminCoupons());
        } catch (e) {
            setError(friendlyError(e, "Error al cargar los cupones."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadCoupons();
    }, [loadCoupons]);

    const set = (field: keyof NewCoupon) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setSaving(true);
        try {
            const created = await createCoupon(form);
            setCoupons((prev) => [created, ...prev]);
            setForm(EMPTY);
            setMessage({ type: "success", text: `Cupón ${created.code} creado.` });
        } catch (err) {
            setMessage({ type: "error", text: friendlyError(err, "No se pudo crear el cupón.") });
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (coupon: AdminCoupon) => {
        setSavingId(coupon.id);
        setMessage(null);
        try {
            const updated = await setCouponActive(coupon.id, !coupon.active);
            setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? updated : c)));
            setMessage({ type: "success", text: `Cupón ${coupon.code} ${updated.active ? "activado" : "desactivado"}.` });
        } catch (err) {
            setMessage({ type: "error", text: friendlyError(err, "No se pudo actualizar el cupón.") });
        } finally {
            setSavingId(null);
        }
    };

    return (
        <MainLayout>
            <PageMeta title="Cupones" noindex />
            <Section className="min-h-screen pt-0 pb-20">
                <Container>
                    <div className="flex flex-col gap-10">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                            <div className="flex flex-col gap-2">
                                <PageTitle className="mb-2">Cupones</PageTitle>
                                <Text className="text-primary-champagne/40 font-black uppercase tracking-[0.3em] text-xs italic">Promociones y descuentos</Text>
                            </div>
                            <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => navigate("/admin")}>Volver al panel</Button>
                        </div>

                        <form onSubmit={handleCreate} className="glass-card p-6 md:p-8 border-white/5 flex flex-col gap-6">
                            <H3 className="text-primary-gold text-sm font-black tracking-[0.2em]">Nuevo cupón</H3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <label className={labelClass}>
                                    Código
                                    <input
                                        value={form.code}
                                        onChange={(e) => set("code")(e.target.value.toUpperCase())}
                                        required
                                        minLength={3}
                                        maxLength={30}
                                        pattern="[A-Za-z0-9_\-]{3,30}"
                                        title="De 3 a 30 letras, números, guiones o guiones bajos"
                                        placeholder="VERANO10"
                                        className={inputClass}
                                    />
                                </label>
                                <label className={labelClass}>
                                    Tipo
                                    <select value={form.discount_type} onChange={(e) => set("discount_type")(e.target.value)} className={inputClass}>
                                        <option value="porcentaje" className="text-black">Porcentaje (%)</option>
                                        <option value="monto" className="text-black">Monto fijo (Q)</option>
                                    </select>
                                </label>
                                <label className={labelClass}>
                                    {form.discount_type === "porcentaje" ? "Porcentaje" : "Monto en quetzales"}
                                    <input
                                        type="number"
                                        value={form.value}
                                        onChange={(e) => set("value")(e.target.value)}
                                        required
                                        min="0.01"
                                        max={form.discount_type === "porcentaje" ? "100" : undefined}
                                        step="0.01"
                                        className={inputClass}
                                    />
                                </label>
                                <label className={labelClass}>
                                    Compra mínima (Q)
                                    <input
                                        type="number"
                                        value={form.min_purchase}
                                        onChange={(e) => set("min_purchase")(e.target.value)}
                                        min="0"
                                        step="0.01"
                                        placeholder="0 = sin mínimo"
                                        className={inputClass}
                                    />
                                </label>
                                <label className={labelClass}>
                                    Límite de usos
                                    <input
                                        type="number"
                                        value={form.max_uses}
                                        onChange={(e) => set("max_uses")(e.target.value)}
                                        min="1"
                                        step="1"
                                        placeholder="Vacío = sin límite"
                                        className={inputClass}
                                    />
                                </label>
                                <label className={labelClass}>
                                    Vence (incluye todo ese día)
                                    <input
                                        type="date"
                                        value={form.expires_at}
                                        onChange={(e) => set("expires_at")(e.target.value)}
                                        required
                                        min={todayGuatemala()}
                                        className={inputClass}
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-primary-champagne/40">
                                El descuento aplica solo a los productos, no al envío. Cada cliente puede usar el cupón una vez.
                            </p>
                            <div>
                                <Button type="submit" disabled={saving} className="px-10 py-3 text-xs disabled:opacity-40">
                                    {saving ? "Creando..." : "Crear cupón"}
                                </Button>
                            </div>
                        </form>

                        {message && (
                            <p role="status" className={`text-sm ${message.type === "success" ? "text-status-success" : "text-status-error"}`}>
                                {message.text}
                            </p>
                        )}

                        {loading ? (
                            <LoadingSpinner message="Cargando cupones..." />
                        ) : error ? (
                            <div className="flex flex-col items-center">
                                <ErrorMessage message={error} />
                                <Button onClick={() => void loadCoupons()} variant="outline" className="-mt-20 px-12">Reintentar</Button>
                            </div>
                        ) : coupons.length === 0 ? (
                            <div className="glass-card p-12 border-white/5 text-center">
                                <Text className="text-primary-champagne/50">Aún no hay cupones.</Text>
                            </div>
                        ) : (
                            <ul className="flex flex-col gap-4">
                                {coupons.map((coupon) => (
                                    <li key={coupon.id} className="glass-card border-white/5 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="font-black tracking-widest text-primary-champagne">{coupon.code}</span>
                                                <StateBadge state={coupon.state} />
                                            </div>
                                            <p className="text-sm text-primary-gold">
                                                {couponLabel(coupon)}
                                                {coupon.min_purchase > 0 && ` · compras desde ${formatPrice(coupon.min_purchase)}`}
                                            </p>
                                            <p className="text-xs text-primary-champagne/40">
                                                {usesLabel(coupon)} · vence el {formatDate(coupon.expires_at)}
                                                {coupon.total_discount > 0 && ` · ${formatPrice(coupon.total_discount)} descontados`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => void toggle(coupon)}
                                            disabled={savingId === coupon.id}
                                            className="h-9 shrink-0 self-start md:self-center border border-primary-gold text-primary-gold rounded-lg px-4 text-[10px] uppercase tracking-widest hover:bg-primary-gold hover:text-primary-black transition-colors disabled:opacity-40"
                                        >
                                            {savingId === coupon.id ? "Guardando..." : coupon.active ? "Desactivar" : "Activar"}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}
