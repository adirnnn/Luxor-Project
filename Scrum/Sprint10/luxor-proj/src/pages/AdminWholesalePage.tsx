import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H3, PageTitle, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { PageMeta } from "../components/seo/PageMeta";
import {
    fetchWholesale,
    saveWholesalePercent,
    searchCustomers,
    setCustomerRole,
    type WholesaleCustomer,
} from "../services/wholesaleService";

// Feedback del cliente: rol Mayorista. El admin define un solo porcentaje de descuento y decide qué
// clientes lo tienen. El descuento se aplica solo en sus compras (lo calcula el servidor).
const input =
    "w-full rounded-2xl border-none bg-primary-black/40 px-4 py-3 text-sm text-primary-champagne placeholder:text-white/20 focus:ring-2 focus:ring-primary-gold";

export default function AdminWholesalePage() {
    const [percent, setPercent] = useState("");
    const [mayoristas, setMayoristas] = useState<WholesaleCustomer[] | null>(null);
    const [busqueda, setBusqueda] = useState("");
    const [resultados, setResultados] = useState<WholesaleCustomer[] | null>(null);
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const cargar = useCallback(async () => {
        try {
            const data = await fetchWholesale();
            setPercent(String(data.percent));
            setMayoristas(data.customers);
        } catch (err) {
            setMensaje({ tipo: "error", texto: (err as Error).message });
            setMayoristas([]);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    const guardarPorcentaje = async (e: FormEvent) => {
        e.preventDefault();
        setOcupado(true);
        try {
            const { percent: guardado } = await saveWholesalePercent(Number(percent));
            setMensaje({ tipo: "ok", texto: `Los mayoristas ahora pagan ${guardado}% menos en todos los perfumes.` });
        } catch (err) {
            setMensaje({ tipo: "error", texto: (err as Error).message });
        } finally {
            setOcupado(false);
        }
    };

    const buscar = async (e: FormEvent) => {
        e.preventDefault();
        setMensaje(null);
        try {
            setResultados((await searchCustomers(busqueda.trim())).customers);
        } catch (err) {
            setMensaje({ tipo: "error", texto: (err as Error).message });
        }
    };

    const cambiarRol = async (cliente: WholesaleCustomer) => {
        const nuevo = cliente.role === "MAYORISTA" ? "CLIENTE" : "MAYORISTA";
        setOcupado(true);
        try {
            await setCustomerRole(cliente.id, nuevo);
            setResultados((prev) => prev?.map((c) => (c.id === cliente.id ? { ...c, role: nuevo } : c)) ?? null);
            setMensaje({
                tipo: "ok",
                texto: nuevo === "MAYORISTA" ? `${cliente.name} ahora es mayorista.` : `${cliente.name} volvió a ser cliente.`,
            });
            await cargar();
        } catch (err) {
            setMensaje({ tipo: "error", texto: (err as Error).message });
        } finally {
            setOcupado(false);
        }
    };

    const fila = (cliente: WholesaleCustomer) => (
        <li key={cliente.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
                <p className="truncate text-primary-champagne">{cliente.name}</p>
                <p className="truncate text-xs text-primary-champagne/50">{cliente.email}</p>
            </div>
            <div className="flex items-center gap-3">
                <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        cliente.role === "MAYORISTA"
                            ? "border-status-success/40 bg-status-success-bg text-status-success"
                            : "border-white/15 text-primary-champagne/60"
                    }`}
                >
                    {cliente.role === "MAYORISTA" ? "Mayorista" : "Cliente"}
                </span>
                <Button variant="outline" className="px-4 py-2 text-xs" disabled={ocupado} onClick={() => void cambiarRol(cliente)}>
                    {cliente.role === "MAYORISTA" ? "Quitar mayorista" : "Hacer mayorista"}
                </Button>
            </div>
        </li>
    );

    return (
        <MainLayout>
            <PageMeta title="Mayoristas" noindex />
            <Section className="min-h-screen pt-0 pb-20">
                <Container className="flex flex-col gap-10">
                    <div className="flex flex-col gap-2">
                        <Link to="/admin" className="text-xs uppercase tracking-[0.2em] text-primary-champagne/50 hover:text-primary-gold">
                            Volver al panel
                        </Link>
                        <PageTitle>Mayoristas</PageTitle>
                        <Text className="text-primary-champagne/60">
                            Los clientes mayoristas pagan todos los perfumes con un descuento fijo. No usan cupones.
                        </Text>
                    </div>

                    {mensaje && (
                        <p
                            role={mensaje.tipo === "error" ? "alert" : "status"}
                            className={`rounded-2xl border px-5 py-4 text-sm ${
                                mensaje.tipo === "error"
                                    ? "border-status-error/40 bg-status-error-bg text-status-error"
                                    : "border-status-success/40 bg-status-success-bg text-status-success"
                            }`}
                        >
                            {mensaje.texto}
                        </p>
                    )}

                    <form onSubmit={guardarPorcentaje} className="glass-card flex flex-col gap-4 border-white/5 p-6 md:flex-row md:items-end md:p-8">
                        <label className="flex flex-1 flex-col gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-gold">Descuento de mayorista (%)</span>
                            <input
                                className={input}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={50}
                                step={1}
                                value={percent}
                                onChange={(e) => setPercent(e.target.value)}
                            />
                        </label>
                        <Button type="submit" disabled={ocupado || !percent}>Guardar</Button>
                    </form>

                    <div className="glass-card flex flex-col gap-4 border-white/5 p-6 md:p-8">
                        <H3 className="text-sm font-black uppercase tracking-[0.2em] text-primary-gold">Mayoristas actuales</H3>
                        {mayoristas === null ? (
                            <LoadingSpinner message="Cargando..." />
                        ) : mayoristas.length === 0 ? (
                            <p className="text-sm text-primary-champagne/50">Todavía no hay clientes mayoristas.</p>
                        ) : (
                            <ul className="divide-y divide-white/5">{mayoristas.map(fila)}</ul>
                        )}
                    </div>

                    <div className="glass-card flex flex-col gap-4 border-white/5 p-6 md:p-8">
                        <H3 className="text-sm font-black uppercase tracking-[0.2em] text-primary-gold">Agregar un mayorista</H3>
                        <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row">
                            <input
                                className={input}
                                aria-label="Buscar cliente por nombre o correo"
                                placeholder="Nombre o correo del cliente"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                            <Button type="submit" variant="outline" disabled={busqueda.trim().length < 2}>Buscar</Button>
                        </form>
                        {resultados && (resultados.length === 0 ? (
                            <p className="text-sm text-primary-champagne/50">No encontramos clientes con esa búsqueda.</p>
                        ) : (
                            <ul className="divide-y divide-white/5">{resultados.map(fila)}</ul>
                        ))}
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}
