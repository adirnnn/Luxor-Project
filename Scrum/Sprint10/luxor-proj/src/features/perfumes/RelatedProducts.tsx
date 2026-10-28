import { useEffect, useState, type FC } from "react";
import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2 } from "../../components/ui/Typography";
import { ProductCard } from "./ProductCard";
import { fetchRelatedProducts } from "../../services/catalogService";
import type { Product } from "../../services/productService";

// SFTWRKEY-430: "También te puede gustar". Si no hay productos parecidos o falla la
// petición, la sección simplemente no se muestra.
export const RelatedProducts: FC<{ productId: string }> = ({ productId }) => {
  const [result, setResult] = useState<{ productId: string; items: Product[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRelatedProducts(productId)
      .then((items) => { if (!cancelled) setResult({ productId, items }); })
      .catch(() => { if (!cancelled) setResult({ productId, items: [] }); });
    return () => { cancelled = true; };
  }, [productId]);

  const items = result?.productId === productId ? result.items : [];
  if (items.length === 0) return null;

  return (
    <Section className="pt-0 pb-24">
      <Container>
        <div className="flex flex-col gap-10" data-testid="related-products">
          <H2 className="tracking-tight text-primary-champagne">También te puede gustar</H2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 md:gap-6 lg:gap-8">
            {items.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                name={p.name}
                price={p.price}
                image={p.image}
                stock={p.stock}
                ratingAvg={p.rating_avg}
                ratingCount={p.rating_count}
                description={p.notes?.corazon}
              />
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
};
