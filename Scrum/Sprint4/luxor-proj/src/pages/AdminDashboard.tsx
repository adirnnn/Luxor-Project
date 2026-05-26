import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { fetchProducts, deleteProduct } from "../services/productService";
import type { Product } from "../services/productService";

export default function AdminDashboard() {
    const { isAuthenticated, user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            <Section size="lg">
                <Container>
                    <div className="flex flex-col gap-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <H1>Panel de Control</H1>
                                <Text>Gestiona el inventario de fragancias.</Text>
                            </div>
                            <Link to="/admin/nuevo">
                                <Button>Nuevo Producto</Button>
                            </Link>
                        </div>

                        {loading ? (
                            <Text>Cargando productos...</Text>
                        ) : error ? (
                            <Text className="text-red-500">{error}</Text>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-primary-beige text-left">
                                            <th className="py-4 px-2 font-semibold">Imagen</th>
                                            <th className="py-4 px-2 font-semibold">Nombre</th>
                                            <th className="py-4 px-2 font-semibold">Precio</th>
                                            <th className="py-4 px-2 font-semibold">Stock</th>
                                            <th className="py-4 px-2 font-semibold">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map(product => (
                                            <tr key={product.id} className="border-b border-primary-beige/50 hover:bg-primary-beige/10">
                                                <td className="py-4 px-2">
                                                    <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded" />
                                                </td>
                                                <td className="py-4 px-2">
                                                    <div className="font-medium text-primary-black">{product.name}</div>
                                                    <div className="text-xs text-secondary-brown">{product.id}</div>
                                                </td>
                                                <td className="py-4 px-2">
                                                    Q{product.price}
                                                </td>
                                                <td className="py-4 px-2">
                                                    {product.stock ?? 0}
                                                </td>
                                                <td className="py-4 px-2">
                                                    <div className="flex items-center gap-2">
                                                        <Link to={`/admin/editar/${product.id}`}>
                                                            <button className="text-xs font-semibold text-blue-600 hover:underline">Editar</button>
                                                        </Link>
                                                        <button 
                                                            onClick={() => handleDelete(product.id)}
                                                            className="text-xs font-semibold text-red-600 hover:underline"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </Container>
            </Section>
        </MainLayout>
    );
}
