import { useEffect, useState } from "react";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { ProductCard } from "../features/perfumes/ProductCard";
import { fetchProducts } from "../services/productService";
import type { Product } from "../services/productService";

export default function PerfumesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError("No se pudieron cargar los productos"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
      <Section size="lg">
        <Container>
          <div className="flex flex-col gap-12">
            <div className="max-w-xl flex flex-col gap-4">
              <H1>Perfumes</H1>
              <Text>Explora nuestra colección completa de fragancias seleccionadas.</Text>
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
        <p className="text-sm text-secondary-brown tracking-wide">Cargando productos...</p>
    </div>
)}
            {error && <p className="text-center text-red-500">{error}</p>}

            {!loading && !error && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    description={product.notes?.corazon}
                  />
                ))}
              </div>
            )}
          </div>
        </Container>
      </Section>
    </MainLayout>
  );
}