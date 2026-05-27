import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { fetchProductById, createProduct, updateProduct } from "../services/productService";
import type { Product } from "../services/productService";

export default function AdminProductPage() {
    const { isAuthenticated, user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;

    const [formData, setFormData] = useState<Product>({
        id: "",
        name: "",
        price: 0,
        image: "",
        description: "",
        stock: 0,
        notes: { salida: "", corazon: "", fondo: "" }
    });
    const [loading, setLoading] = useState(isEditing);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isEditing && isAuthenticated && user?.role === 'ADMIN') {
            fetchProductById(id!)
                .then(data => setFormData(data))
                .catch(() => setError("No se pudo cargar el producto."))
                .finally(() => setLoading(false));
        }
    }, [id, isEditing, isAuthenticated, user]);

    if (!isAuthenticated || user?.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name.startsWith("notes.")) {
            const noteKey = name.split(".")[1];
            setFormData(prev => ({
                ...prev,
                notes: { ...prev.notes, [noteKey]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: (name === "price" || name === "stock") ? Number(value) : value }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await updateProduct(id!, formData);
            } else {
                await createProduct(formData);
            }
            navigate("/admin");
        } catch {
            setError("Error al guardar producto.");
        }
    };

    if (loading) return <MainLayout><Section><Container><Text>Cargando...</Text></Container></Section></MainLayout>;

    return (
        <MainLayout>
            <Section size="lg" className="min-h-screen pt-32 pb-20">
                <Container>
                    <div className="max-w-4xl mx-auto flex flex-col gap-12">
                        <div className="flex flex-col gap-2">
                            <H1 className="text-primary-gold mb-2 font-light italic uppercase tracking-tighter">{isEditing ? "Perfeccionar Fragancia" : "Nueva Obra"}</H1>
                            <Text className="text-primary-champagne/40 font-black uppercase tracking-[0.3em] text-xs italic">Detalles de la Colección Habibi</Text>
                        </div>

                        {error && (
                            <div className="p-4 glass-card border-red-500/20 text-red-500 text-center font-bold italic">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="glass-card p-10 md:p-16 flex flex-col gap-10 border-white/5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Referencia ID</label>
                                    <input 
                                        type="text" name="id" value={formData.id} onChange={handleChange} disabled={isEditing}
                                        className="w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300 disabled:opacity-30"
                                        placeholder="ej: club-de-nuit" required
                                    />
                                </div>
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Nombre del Elixir</label>
                                    <input 
                                        type="text" name="name" value={formData.name} onChange={handleChange}
                                        className="w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300"
                                        placeholder="Nombre del perfume" required
                                    />
                                </div>
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Inversión (Q)</label>
                                    <input 
                                        type="number" name="price" value={formData.price} onChange={handleChange}
                                        className="w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300"
                                        placeholder="0.00" required
                                    />
                                </div>
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Archivo de Imagen</label>
                                    <input 
                                        type="text" name="image" value={formData.image} onChange={handleChange}
                                        className="w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300"
                                        placeholder="/assets/products/..." required
                                    />
                                </div>
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Existencias</label>
                                    <input 
                                        type="number" name="stock" value={formData.stock} onChange={handleChange}
                                        className="w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300"
                                        placeholder="0" required
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Descripción Artística</label>
                                <textarea 
                                    name="description" value={formData.description} onChange={handleChange}
                                    className="w-full px-6 py-4 rounded-[32px] border-none text-base text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300 min-h-[120px]"
                                    placeholder="Describe la experiencia olfativa..." required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-white/5">
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Salida</label>
                                    <input 
                                        type="text" name="notes.salida" value={formData.notes.salida} onChange={handleChange}
                                        className="w-full px-6 py-4 rounded-2xl border-none text-sm text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all"
                                        placeholder="Notas de salida"
                                    />
                                </div>
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Corazón</label>
                                    <input 
                                        type="text" name="notes.corazon" value={formData.notes.corazon} onChange={handleChange}
                                        className="w-full px-6 py-4 rounded-2xl border-none text-sm text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all"
                                        placeholder="Notas de corazón"
                                    />
                                </div>
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">Fondo</label>
                                    <input 
                                        type="text" name="notes.fondo" value={formData.notes.fondo} onChange={handleChange}
                                        className="w-full px-6 py-4 rounded-2xl border-none text-sm text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all"
                                        placeholder="Notas de fondo"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-6 pt-10">
                                <Button type="submit" className="flex-1 py-6 shadow-[0_20px_50px_rgba(212,175,55,0.2)]">{isEditing ? "Guardar Cambios" : "Crear Perfume"}</Button>
                                <Button type="button" variant="outline" onClick={() => navigate("/admin")} className="px-12 py-6">Cancelar</Button>
                            </div>
                        </form>
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}
