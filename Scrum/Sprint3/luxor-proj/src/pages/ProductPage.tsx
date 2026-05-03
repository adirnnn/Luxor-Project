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

  return (
    <MainLayout>
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
        <p className="text-sm text-secondary-brown tracking-wide">Cargando producto...</p>
    </div>
)}
      {error && <p className="py-20 text-center text-red-500">{error}</p>}
      {product && <ProductDetail {...product} />}
    </MainLayout>
  );
}