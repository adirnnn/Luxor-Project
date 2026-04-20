import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { ProductCard } from "./ProductCard";
import { products } from "../../data/products";

export const FeaturedPerfumesSection = () => {
  return (
    <Section size="lg" id="perfumes">
      <Container>
        <div className="flex flex-col gap-10">

          <div className="max-w-lg flex flex-col gap-4">
            <H2 className="tracking-tight">Fragancias destacadas</H2>
            <Text>
              Una selección curada para quienes entienden que el aroma es parte de su identidad.
            </Text>
          </div>

          <div className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.image}
                  description={`${product.notes.salida} · ${product.notes.corazon}`}
                />
              ))}
            </div>
          </div>

        </div>
      </Container>
    </Section>
  );
};