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
                                {/* Toggle View Mode */}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                                {products.map(product => (
                                    <div key={product.id} className="glass-card p-10 flex flex-col gap-8 hover:scale-[1.03] transition-all duration-700 group relative overflow-hidden border-white/5">
                                        <div className="absolute top-0 right-0 p-6">
                                            <span className="text-[10px] font-black text-primary-gold/20 tracking-[0.4em] uppercase">Ref: {product.id.slice(-4)}</span>
                                        </div>
                                        
                                        <div className="flex flex-col gap-8">
                                            <div className="w-full aspect-square bg-primary-black/40 rounded-[32px] overflow-hidden p-8 border border-white/5 shadow-inner group">
                                                <img 
                                                    src={product.image} 
                                                    alt={product.name} 
                                                    className="w-full h-full object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-110" 
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <H3 className="text-2xl font-light text-primary-champagne uppercase tracking-tight truncate">{product.name}</H3>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-2xl font-light text-primary-gold">Q{product.price}</span>
                                                    <span className="px-4 py-1 bg-white/5 rounded-full text-[10px] font-bold text-primary-champagne/30 uppercase tracking-widest italic">Stock: {product.stock ?? 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                                            <Link to={`/admin/editar/${product.id}`} className="w-full">
                                                <Button variant="outline" className="w-full py-4 text-[10px] font-black tracking-[0.2em] italic flex justify-center items-center text-center">EDITAR</Button>
                                            </Link>
                                            <Button 
                                                variant="ghost" 
                                                className="w-full py-4 text-[10px] font-black text-red-500/60 hover:text-red-500 tracking-[0.2em] italic flex justify-center items-center text-center"
                                                onClick={() => handleDelete(product.id)}
                                            >
                                                ELIMINAR
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                {products.map(product => (
                                    <div key={product.id} className="glass-card p-6 flex flex-row items-center gap-10 hover:bg-white/[0.02] transition-all duration-700 group border-white/5">
                                        <div className="w-24 h-24 bg-primary-black/40 rounded-2xl overflow-hidden p-4 border border-white/5 shadow-inner shrink-0 group-hover:bg-primary-black transition-all">
                                            <img src={product.image} alt={product.name} className="w-full h-full object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
                                        </div>
                                        
                                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                                            <H3 className="text-xl font-light text-primary-champagne uppercase tracking-tight truncate">{product.name}</H3>
                                            <div className="flex items-center gap-6">
                                                <span className="text-xl font-light text-primary-gold">Q{product.price}</span>
                                                <span className="text-[10px] font-bold text-primary-champagne/20 uppercase tracking-[0.3em] italic">Ref: {product.id}</span>
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-8 pr-4">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-black text-primary-champagne/20 uppercase tracking-widest italic">Existencias</span>
                                                <span className="text-lg font-light text-primary-champagne/60">{product.stock ?? 0}</span>
                                            </div>
                                            <div className="h-10 w-px bg-white/5" />
                                            <div className="flex items-center gap-4">
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
                                ))}
                            </div>
                        )}
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}
