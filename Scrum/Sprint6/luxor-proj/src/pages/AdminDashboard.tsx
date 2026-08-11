import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, H3, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { fetchProducts, deleteProduct } from "../services/productService";
import type { Product } from "../services/productService";

export default function AdminDashboard() {
    const { isAuthenticated, user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const loadProducts = async () => {
        try {
            setLoading(true);
            const data = await fetchProducts();
            setProducts(data);
        } catch {
            setError("Error al cargar productos.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && user?.role === 'ADMIN') {
            loadProducts();
        }
    }, [isAuthenticated, user]);

    if (!isAuthenticated || user?.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que quieres eliminar este producto?")) return;
        try {
            await deleteProduct(id);
            setProducts(prev => prev.filter(p => p.id !== id));
        } catch {
            alert("No se pudo eliminar el producto.");
        }
    };

    return (
        <MainLayout>
            <Section size="lg" className="min-h-screen pt-32 pb-20">
                <Container>
                    <div className="flex flex-col gap-16">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
                            <div className="flex flex-col gap-2">
                                <H1 className="text-primary-gold mb-2 font-light italic uppercase tracking-tighter">Panel Maestro</H1>
                                <Text className="text-primary-champagne/40 font-black uppercase tracking-[0.3em] text-xs italic">Gestión de Inventario y Operaciones</Text>
                            </div>

                            <div className="flex flex-wrap items-center gap-6">
                                <div className="flex bg-white/5 p-1.5 rounded-full border border-white/5 shadow-inner">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-3 rounded-full transition-all duration-500 ${viewMode === 'grid' ? 'bg-primary-gold text-primary-black shadow-xl scale-110' : 'text-primary-champagne/30 hover:text-primary-champagne hover:bg-white/5'}`}
                                        title="Vista de Cuadrícula"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-3 rounded-full transition-all duration-500 ${viewMode === 'list' ? 'bg-primary-gold text-primary-black shadow-xl scale-110' : 'text-primary-champagne/30 hover:text-primary-champagne hover:bg-white/5'}`}
                                        title="Vista de Lista"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                    </button>
                                </div>

                                <Link to="/admin/importar">
                                    <Button variant="outline" className="transition-all">Importar CSV</Button>
                                </Link>

                                <Link to="/admin/nuevo">
                                    <Button className="shadow-[0_20px_50px_rgba(212,175,55,0.2)] hover:scale-110 active:scale-95 transition-all">
                                        Nuevo Perfume
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {loading ? (
                            <div className="py-32 flex flex-col items-center gap-6">
                                <div className="w-16 h-16 border-2 border-primary-gold/20 border-t-primary-gold rounded-full animate-spin" />
                                <Text className="text-primary-gold animate-pulse font-black tracking-[0.4em] uppercase text-xs italic">Sincronizando Bóveda...</Text>
                            </div>
                        ) : error ? (
                            <div className="p-12 glass-card border-red-500/20 text-center">
                                <Text className="text-red-500 font-bold italic">{error}</Text>
                                <Button onClick={loadProducts} className="mt-8 px-12" variant="outline">Reintentar</Button>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-12">
                                {products.map(product => (
                                    <div key={product.id} className="glass-card p-4 md:p-10 flex flex-col gap-4 md:gap-8 hover:scale-[1.03] transition-all duration-700 group relative overflow-hidden border-white/5">
                                        <div className="absolute top-0 right-0 p-3 md:p-6">
                                            <span className="hidden md:inline text-[10px] font-black text-primary-gold/20 tracking-[0.4em] uppercase">Ref: {product.id.slice(-4)}</span>
                                        </div>
                                        <div className="flex flex-col gap-3 md:gap-8">
                                            <div className="w-full aspect-square bg-primary-black/40 rounded-2xl md:rounded-[32px] overflow-hidden p-3 md:p-8 border border-white/5 shadow-inner">
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-full h-full object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-110"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1 md:gap-2">
                                                <H3 className="text-xs md:text-2xl font-light text-primary-champagne uppercase tracking-tight truncate">{product.name}</H3>
                                                <div className="flex items-center justify-between flex-wrap gap-1">
                                                    <span className="text-sm md:text-2xl font-light text-primary-gold">Q{product.price}</span>
                                                    <span className="px-2 md:px-4 py-0.5 md:py-1 bg-white/5 rounded-full text-[8px] md:text-[10px] font-bold text-primary-champagne/30 uppercase tracking-widest italic">
                                                        Stock: {product.stock ?? 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 md:gap-4 pt-3 md:pt-6 border-t border-white/5">
                                            <Link to={`/admin/editar/${product.id}`} className="md:hidden w-full">
                                                <button className="w-full h-9 flex items-center justify-center rounded-xl border border-white/10 text-primary-champagne/40 hover:text-primary-gold hover:border-primary-gold/30 transition-all">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                            </Link>
                                            <button
                                                className="md:hidden w-full h-9 flex items-center justify-center rounded-xl border border-white/10 text-red-500/30 hover:text-red-500 hover:border-red-500/30 transition-all"
                                                onClick={() => handleDelete(product.id)}
                                                aria-label="Eliminar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                    <path d="M10 11v6M14 11v6" />
                                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                </svg>
                                            </button>

                                            <Link to={`/admin/editar/${product.id}`} className="hidden md:block w-full">
                                                <Button variant="outline" className="w-full py-4 text-[10px] font-black tracking-[0.2em] italic flex justify-center items-center text-center">EDITAR</Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                className="hidden md:flex w-full py-4 text-[10px] font-black text-red-500/60 hover:text-red-500 tracking-[0.2em] italic justify-center items-center text-center"
                                                onClick={() => handleDelete(product.id)}
                                            >
                                                ELIMINAR
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 md:gap-6">
                                {products.map(product => (
                                    <div key={product.id} className="glass-card border-white/5 hover:bg-white/[0.02] transition-all duration-700 group">
                                        <div className="flex items-center gap-3 md:gap-10 p-3 md:p-6">
                                            <div className="w-14 h-14 md:w-24 md:h-24 bg-primary-black/40 rounded-xl md:rounded-2xl overflow-hidden p-2 md:p-4 border border-white/5 shadow-inner shrink-0">
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-full h-full object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col gap-0.5 md:gap-1">
                                                <H3 className="text-sm md:text-xl font-light text-primary-champagne uppercase tracking-tight truncate">{product.name}</H3>
                                                <div className="flex items-center gap-2 md:gap-6">
                                                    <span className="text-sm md:text-xl font-light text-primary-gold">Q{product.price}</span>
                                                    <span className="hidden md:inline text-[10px] font-bold text-primary-champagne/20 uppercase tracking-[0.3em] italic">Ref: {product.id}</span>
                                                </div>
                                            </div>

                                            <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                                                <span className="text-[10px] font-black text-primary-champagne/20 uppercase tracking-widest italic">Existencias</span>
                                                <span className="text-lg font-light text-primary-champagne/60">{product.stock ?? 0}</span>
                                            </div>
                                            <div className="hidden md:block h-10 w-px bg-white/5" />
                                            <div className="flex items-center gap-2 md:gap-4 shrink-0">
                                                <div className="flex md:hidden items-center gap-2">
                                                    <Link
                                                        to={`/admin/editar/${product.id}`}
                                                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-primary-champagne/40 hover:text-primary-gold hover:border-primary-gold/30 transition-all"
                                                        aria-label="Editar"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-red-500/30 hover:text-red-500 hover:border-red-500/30 transition-all"
                                                        aria-label="Eliminar"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                            <path d="M10 11v6M14 11v6" />
                                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <div className="hidden md:flex items-center gap-4">
                                                    <Link to={`/admin/editar/${product.id}`}>
                                                        <Button variant="outline" className="px-10 py-3 text-[10px] font-black tracking-[0.2em] italic flex justify-center items-center">EDITAR</Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        className="px-10 py-3 text-[10px] font-black text-red-500/60 hover:text-red-500 tracking-[0.2em] italic flex justify-center items-center"
                                                        onClick={() => handleDelete(product.id)}
                                                    >
                                                        ELIMINAR
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}
