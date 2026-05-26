import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { ProductDetail } from "../features/perfumes/ProductDetail";
import { fetchProductById } from "../services/productService";
import type { Product } from "../services/productService";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("ID de producto no válido.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchProductById(id)
      .then((data) => {
        // SFTWRKEY-251: Validar que la respuesta tenga los campos esperados
        if (!data || !data.id || !data.name) {
          throw new Error("Respuesta del servidor incompleta.");
        }
        setProduct(data);
      })
      .catch((err: Error) => setError(err.message || "Producto no encontrado."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <MainLayout>
      {loading && <LoadingSpinner message="Cargando producto..." />}
      {error && <ErrorMessage message={error} />}
      {product && <ProductDetail {...product} />}
    </MainLayout>
  );
}