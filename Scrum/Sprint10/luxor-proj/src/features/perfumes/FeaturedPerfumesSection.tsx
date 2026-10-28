import { useEffect, useState } from "react";
import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { ProductCard } from "./ProductCard";
import { fetchProducts, type Product } from "../../services/productService";
import { friendlyError } from "../../services/apiClient";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorMessage } from "../../components/ui/ErrorMessage";

export const FeaturedPerfumesSection = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // SFTWRKEY-423: antes, si la API fallaba, la sección quedaba vacía sin ningún aviso
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch((err: unknown) => setError(friendlyError(err, "No se pudieron cargar las fragancias.")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Section size="lg" id="perfumes" className="bg-primary-black">
      <Container>
        <div className="flex flex-col gap-10">

          <div className="max-w-lg flex flex-col gap-4">
            <H2 className="tracking-tight text-primary-champagne">Fragancias destacadas</H2>
            <Text className="text-primary-champagne/80">
              Una selección curada para quienes entienden que el aroma es parte de su identidad.
            </Text>
          </div>

          <div className="mt-4">
            {loading ? (
              <LoadingSpinner message="Cargando fragancias..." />
            ) : error ? (
              <ErrorMessage message={error} />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-12">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    stock={product.stock}
                    ratingAvg={product.rating_avg}
                    ratingCount={product.rating_count}
                    description={product.notes ? `${product.notes.salida} · ${product.notes.corazon}` : product.description}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </Container>
    </Section>
  );
};