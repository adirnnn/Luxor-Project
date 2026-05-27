import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, H3, Text } from "../components/ui/Typography";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface ReportData {
    totalUsers: number;
    totalItemsInCarts: number;
    topProducts: { product_id: string; total_quantity: string }[];
}

export default function ReportPage() {
    const { isAuthenticated, user } = useAuth();
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isAuthenticated && user?.role === 'ADMIN') {
            fetch(`${API_URL}/report`)
                .then((res) => {
                    if (!res.ok) throw new Error("Error al cargar reporte");
                    return res.json();
                })
                .then((res) => setData(res.data))
                .catch(() => setError("No se pudo cargar el reporte. Intenta más tarde."))
                .finally(() => setLoading(false));
        }
    }, [isAuthenticated, user]);

    // Solo ADMINs pueden ver el reporte
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (user?.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    return (
        <MainLayout>
            <Section size="lg">
                <Container>
                    <div className="flex flex-col gap-10">
                        <div className="flex flex-col gap-2">
                            <H1>Reporte general</H1>
                            <Text>Resumen del estado actual del negocio.</Text>
                        </div>

                        {loading && (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <svg
                                    className="animate-spin text-primary-gold"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="36"
                                    height="36"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="12" y1="2" x2="12" y2="6" />
                                    <line x1="12" y1="18" x2="12" y2="22" />
                                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                                    <line x1="2" y1="12" x2="6" y2="12" />
                                    <line x1="18" y1="12" x2="22" y2="12" />
                                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                                </svg>
                                <p className="text-sm text-primary-champagne/70 tracking-wide">Cargando reporte...</p>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {data && (
                            <div className="flex flex-col gap-8">
                                {/* Tarjetas resumen */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div className="glass-card p-10 flex flex-col gap-4 border-white/5">
                                        <Text className="text-xs tracking-[0.3em] uppercase text-primary-gold font-black italic">
                                            Usuarios registrados
                                        </Text>
                                        <span className="text-6xl font-heading text-primary-champagne font-light">
                                            {data.totalUsers}
                                        </span>
                                    </div>

                                    <div className="glass-card p-10 flex flex-col gap-4 border-white/5">
                                        <Text className="text-xs tracking-[0.3em] uppercase text-primary-gold font-black italic">
                                            Productos en carritos
                                        </Text>
                                        <span className="text-6xl font-heading text-primary-champagne font-light">
                                            {data.totalItemsInCarts}
                                        </span>
                                    </div>
                                </div>

                                {/* Top productos */}
                                <div className="glass-card p-10 flex flex-col gap-8 border-white/5">
                                    <H3 className="text-primary-gold tracking-[0.2em] italic">Top Movimientos</H3>
                                    {data.topProducts.length === 0 ? (
                                        <Text>No hay datos de productos aún.</Text>
                                    ) : (
                                        <div className="flex flex-col gap-6">
                                            {data.topProducts.map((item, index) => (
                                                <div
                                                    key={item.product_id}
                                                    className="flex items-center justify-between py-5 border-b border-white/5 last:border-0 group hover:bg-white/[0.02] px-4 transition-all rounded-xl"
                                                >
                                                    <div className="flex items-center gap-6">
                                                        <span className="text-lg font-heading text-primary-gold/40 font-light w-8 italic">
                                                            0{index + 1}
                                                        </span>
                                                        <Text className="capitalize text-xl text-primary-champagne font-medium">
                                                            {item.product_id.replace(/-/g, " ")}
                                                        </Text>
                                                    </div>
                                                    <span className="text-lg font-heading text-primary-gold font-light tracking-tighter">
                                                        {item.total_quantity} <span className="text-xs uppercase ml-1 opacity-40 italic">Uds.</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}