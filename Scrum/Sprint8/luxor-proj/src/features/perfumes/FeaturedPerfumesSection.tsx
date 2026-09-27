import { useEffect, useState } from "react";
import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { ProductCard } from "./ProductCard";
import { fetchProducts, type Product } from "../../services/productService";

export const FeaturedPerfumesSection = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts().then(setProducts).finally(() => setLoading(false));
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
              <Text className="text-primary-champagne/80">Cargando fragancias...</Text>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-12">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
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