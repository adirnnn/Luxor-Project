import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { fetchProductById, createProduct, updateProduct, fetchCategories } from "../services/productService";
import type { Product, Category } from "../services/productService";
import { PerfumApiSearch } from "../features/perfumes/PerfumApiSearch";
import type { ExternalPerfumeCandidate } from "../services/perfumApiService";

type FieldProps = {
    label: string;
    name: string;
    value: string | number;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    multiline?: boolean;
    required?: boolean;
};

const Field = ({ label, name, value, onChange, type = "text", placeholder, disabled, multiline, required }: FieldProps) => (
<div className="flex flex-col gap-2">
    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-gold italic">
        {label}
    </label>
    {multiline ? (
        <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        required={required}
        className="w-full px-4 py-3 rounded-2xl border-none text-sm text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300 resize-none"
        />
    ) : (
        <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full px-4 py-3 rounded-2xl border-none text-sm text-primary-champagne bg-primary-black/40 placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300 disabled:opacity-30"
        />
    )}
    </div>
);

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
    category_id: null,
    brand: "",
    notes: { salida: "", corazon: "", fondo: "" },
    });
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

useEffect(() => {
    // SFTWRKEY-275: Cargar categorías disponibles para el selector del formulario
    fetchCategories()
        .then(setCategories)
        .catch(() => setCategories([]));
}, []);

useEffect(() => {
    if (isEditing && isAuthenticated && user?.role === "ADMIN") {
        fetchProductById(id!)
        .then((data) => setFormData(data))
        .catch(() => setError("No se pudo cargar el producto."))
        .finally(() => setLoading(false));
    }
}, [id, isEditing, isAuthenticated, user]);

if (!isAuthenticated || user?.role !== "ADMIN") {
    return <Navigate to="/" replace />;
}

const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith("notes.")) {
        const noteKey = name.split(".")[1];
        setFormData((prev) => ({
        ...prev,
        notes: { ...prev.notes, [noteKey]: value },
        }));
    } else {
        setFormData((prev) => ({
        ...prev,
        [name]: name === "price" || name === "stock" ? Number(value) : value,
        }));
    }
};

// integracion PerfumAPI: autocompletar el formulario con el candidato elegido
// (id, price, stock y category_id NO vienen de la API, los define el admin)
const handleApiSelect = (candidate: ExternalPerfumeCandidate) => {
    setFormData((prev) => ({
        ...prev,
        name: candidate.name,
        brand: candidate.brand,
        image: candidate.image,
        description: candidate.description,
        notes: { ...candidate.notes },
        external_source: candidate.external_source,
        external_id: candidate.external_id,
        synced_at: candidate.synced_at,
    }));
};

// SFTWRKEY-275: Manejar el cambio del selector de categoría (select, no input)
const handleCategoryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({
        ...prev,
        category_id: value === "" ? null : Number(value),
    }));
};

    const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.id.trim() || !formData.name.trim() || !formData.price) {
        setError("ID, nombre y precio son obligatorios.");
        return;
    }
    setSaving(true);
    try {
        if (isEditing) {
        await updateProduct(id!, formData);
        } else {
        await createProduct(formData);
        }
        navigate("/admin");
    } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar producto.");
        setSaving(false);
    }
};

if (loading) {
    return (
        <MainLayout>
        <Section>
            <Container>
            <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-10 h-10 border-2 border-primary-gold/20 border-t-primary-gold rounded-full animate-spin" />
                <Text className="text-primary-gold animate-pulse text-xs uppercase tracking-widest italic">Cargando...</Text>
            </div>
        </Container>
        </Section>
    </MainLayout>
    );
}

return (
    <MainLayout>
        <Section size="lg" className="min-h-screen pt-28 md:pt-32 pb-20">
        <Container>
            <div className="max-w-3xl mx-auto flex flex-col gap-8">

            {/* Header */}
            <div className="flex items-center gap-4">
            <button
                onClick={() => navigate("/admin")}
                className="text-primary-champagne/30 hover:text-primary-gold transition-all p-2 -ml-2"
                aria-label="Volver"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
            </button>
            <div>
                <H1 className="text-2xl md:text-5xl text-primary-gold font-light italic uppercase tracking-tighter leading-none">
                    {isEditing ? "Editar Fragancia" : "Nueva Fragancia"}
                </H1>
                <p className="text-[10px] text-primary-champagne/30 uppercase tracking-[0.3em] font-black italic mt-1">
                    {isEditing ? "Actualizar datos del producto" : "Añadir a la colección Habibi"}
                </p>
                </div>
            </div>

            {/* Error */}
            {error && (
            <div className="p-4 glass-card border-red-500/20 text-red-500 text-center text-sm font-bold italic rounded-2xl">
                {error}
            </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                <div className="glass-card p-5 md:p-8 flex flex-col gap-4 border-white/5 rounded-[28px]">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-champagne/20 italic">
                    Importar desde PerfumAPI
                </p>
                <PerfumApiSearch onSelect={handleApiSelect} />
                <p className="text-[10px] text-primary-champagne/25 italic">
                    Selecciona un resultado para autocompletar marca, imagen, descripción y notas. Tú solo defines ID, categoría, precio y stock.
                </p>
                </div>

                <div className="glass-card p-5 md:p-8 flex flex-col gap-5 border-white/5 rounded-[28px]">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-champagne/20 italic">
                Información principal
                </p>

                <Field
                    label="ID de Referencia"
                    name="id"
                    value={formData.id}
                    onChange={handleChange}
                    placeholder="ej: club-de-nuit"
                    disabled={isEditing}
                    required
                />

                <Field
                    label="Nombre del Perfume"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Nombre del perfume"
                    required
                />

                <Field
                    label="Marca"
                    name="brand"
                    value={formData.brand ?? ""}
                    onChange={handleChange}
                    placeholder="Ej: Chanel, Lattafa..."
                />

                {/* SFTWRKEY-275: Selector de categoría */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-gold italic">
                        Categoría
                    </label>
                    <div className="relative">
                        <select
                            name="category_id"
                            value={formData.category_id ?? ""}
                            onChange={handleCategoryChange}
                            className="w-full appearance-none px-4 py-3 pr-10 rounded-2xl border-none text-sm text-primary-champagne bg-primary-black/40 focus:ring-2 focus:ring-primary-gold transition-all duration-300"
                        >
                            <option value="" style={{ backgroundColor: "#1A1614", color: "#FDFCFB" }}>
                                Sin categoría
                            </option>
                            {categories.map((c) => (
                                <option
                                    key={c.id}
                                    value={c.id}
                                    style={{ backgroundColor: "#1A1614", color: "#FDFCFB" }}
                                >
                                    {c.nombre}
                                </option>
                            ))}
                        </select>
                        <svg
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-gold pointer-events-none"
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <Field
                    label="Precio (Q)"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    type="number"
                    placeholder="0"
                    required
                />
                <Field
                    label="Stock"
                    name="stock"
                    value={formData.stock ?? 0}
                    onChange={handleChange}
                    type="number"
                    placeholder="0"
                    />
                </div>

                <Field
                    label="URL de Imagen"
                    name="image"
                    value={formData.image}
                    onChange={handleChange}
                    placeholder="/assets/products/..."
                />

                <Field
                    label="Descripción"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe la experiencia olfativa..."
                    multiline
                />
                </div>

                <div className="glass-card p-5 md:p-8 flex flex-col gap-5 border-white/5 rounded-[28px]">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-champagne/20 italic">
                    Notas olfativas
                </p>

                <Field
                    label="Salida"
                    name="notes.salida"
                    value={formData.notes.salida}
                    onChange={handleChange}
                    placeholder="Ej: Limón, bergamota"
                />
                <Field
                    label="Corazón"
                    name="notes.corazon"
                    value={formData.notes.corazon}
                    onChange={handleChange}
                    placeholder="Ej: Rosa, jazmín"
                />
                <Field
                    label="Fondo"
                    name="notes.fondo"
                    value={formData.notes.fondo}
                    onChange={handleChange}
                    placeholder="Ej: Madera, ámbar"
                />
            </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-5 shadow-[0_20px_50px_rgba(212,175,55,0.2)] text-sm"
                >
                    {saving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Perfume"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/admin")}
                    className="sm:px-12 py-5 text-sm"
                >
                    Cancelar
                </Button>
                </div>

            </form>
            </div>
        </Container>
        </Section>
    </MainLayout>
    );
}