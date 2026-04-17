import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { ProductCard } from "../features/perfumes/ProductCard";
import { products } from "../data/products";

export default function PerfumesPage() {
  return (
    <MainLayout>
      <Section size="lg">
        <Container>
          <div className="flex flex-col gap-12">

            <div className="max-w-xl flex flex-col gap-4">
              <H1>Perfumes</H1>
              <Text>
                Explora nuestra colección completa de fragancias seleccionadas.
              </Text>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.image}
                  description={product.notes.corazon}
                />
              ))}
            </div>

          </div>
        </Container>
      </Section>
    </MainLayout>
  );
}