import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { ProductDetail } from "../features/perfumes/ProductDetail";
import { fetchProductById } from "../services/productService";
import type { Product } from "../services/productService";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchProductById(id)
      .then(setProduct)
      .catch(() => setError("Producto no encontrado"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <div className="py-20 text-center">Cargando producto...</div>
      </MainLayout>
    );
  }

  if (error || !product) {
    return (
      <MainLayout>
        <div className="py-20 text-center">Producto no encontrado</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ProductDetail {...product} />
    </MainLayout>
  );
}