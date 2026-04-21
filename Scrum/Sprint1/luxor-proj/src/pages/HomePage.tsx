import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { FeaturedPerfumesSection } from "../features/perfumes/FeaturedPerfumesSection";
import { BrandSection } from "../features/brand/BrandSection";
import { CTASection } from "../features/cta/CTASection";

export default function HomePage() {
  return (
    <MainLayout>

      {/* Hero */}
      <Section size="lg">
        <Container>
          <div className="grid md:grid-cols-2 gap-8 md:gap-24 items-center">

            <div className="flex flex-col gap-8 max-w-xl md:translate-y-8">

              <span className="text-xs tracking-[0.25em] uppercase text-secondary-brown">
                Joyero Árabe
              </span>

              <H1 className="leading-[1.02] tracking-tight text-primary-black">
                No es solo aroma.
                <br />
                Es cómo te recuerdan.
              </H1>

              <Text className="max-w-md">
                Perfumes seleccionados para quienes entienden que la presencia
                no se improvisa.
              </Text>

              <div className="pt-6">
                <a href="#perfumes">
                  <Button className="px-10 py-4 text-base">
                    Descubrir fragancias
                  </Button>
                </a>
              </div>
            </div>

            <div className="relative md:-mr-6">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-nude/60 to-primary-beige/30" />

              <div className="relative h-[480px] md:h-[640px] overflow-hidden shadow-soft md:rounded-none rounded-xl">
                <img
                  src="https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=1600&auto=format&fit=crop"
                  alt="Perfume de lujo"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-primary-champagne/50" />
              </div>
            </div>

          </div>
        </Container>
      </Section>

      {/* Featured Products */}
      <FeaturedPerfumesSection />

      {/* Brand Section */}
      <BrandSection />

      {/* CTA */}
      <CTASection />

    </MainLayout>
  );
}