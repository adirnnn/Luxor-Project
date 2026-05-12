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
            <Section size="lg">
                <Container>
                    <div className="max-w-2xl mx-auto flex flex-col gap-8">
                        <div>
                            <H1>{isEditing ? "Editar Producto" : "Nuevo Producto"}</H1>
                            <Text>Completa la información de la fragancia.</Text>
                        </div>

                        {error && <Text className="text-red-500">{error}</Text>}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">ID (slug)</label>
                                    <input 
                                        type="text" name="id" value={formData.id} onChange={handleChange} disabled={isEditing}
                                        className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold"
                                        placeholder="ej: club-de-nuit" required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">Nombre</label>
                                    <input 
                                        type="text" name="name" value={formData.name} onChange={handleChange}
                                        className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold"
                                        placeholder="Nombre del perfume" required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">Precio (Q)</label>
                                    <input 
                                        type="number" name="price" value={formData.price} onChange={handleChange}
                                        className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold"
                                        placeholder="0.00" required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">URL Imagen</label>
                                    <input 
                                        type="text" name="image" value={formData.image} onChange={handleChange}
                                        className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold"
                                        placeholder="/src/assets/products/..." required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">Stock</label>
                                    <input 
                                        type="number" name="stock" value={formData.stock} onChange={handleChange}
                                        className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold"
                                        placeholder="0" required
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">Descripción</label>
                                <textarea 
                                    name="description" value={formData.description} onChange={handleChange}
                                    className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold min-h-[100px]"
                                    placeholder="Breve descripción..." required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">Salida</label>
                                    <input 
                                        type="text" name="notes.salida" value={formData.notes.salida} onChange={handleChange}
                                        className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold"
                                        placeholder="Notas de salida"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">Corazón</label>
                                    <input 
                                        type="text" name="notes.corazon" value={formData.notes.corazon} onChange={handleChange}
                                        className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold"
                                        placeholder="Notas de corazón"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">Fondo</label>
                                    <input 
                                        type="text" name="notes.fondo" value={formData.notes.fondo} onChange={handleChange}
                                        className="bg-white border border-primary-beige rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold"
                                        placeholder="Notas de fondo"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button type="submit" className="flex-1">{isEditing ? "Guardar Cambios" : "Crear Producto"}</Button>
                                <Button type="button" variant="outline" onClick={() => navigate("/admin")}>Cancelar</Button>
                            </div>
                        </form>
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}
