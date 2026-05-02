import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";

export const BrandSection = () => {
  return (
    <Section size="lg" id="brand" className="pt-24 md:pt-32">
      <Container>
        <div className="flex flex-col items-center text-center gap-8">

          <span className="text-xs tracking-[0.25em] uppercase text-secondary-brown">
            Joyero Árabe
          </span>

          <div className="w-10 h-[1px] bg-primary-beige mx-auto" />

          <div className="max-w-2xl flex flex-col gap-8">
            <H2 className="text-[2rem] md:text-[2.4rem] leading-[1.2]">
              Elegir bien no es casualidad.
            </H2>

            <Text className="text-base">
              Cada fragancia es seleccionada con criterio, experiencia y una visión clara:
              proyectar presencia sin decir una palabra.
            </Text>

            <Text className="text-base">
              Joyero Árabe no sigue tendencias.
              Define estándares para quienes entienden que el aroma también es identidad.
            </Text>
          </div>

        </div>
      </Container>
    </Section>
  );
};