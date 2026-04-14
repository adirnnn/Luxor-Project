import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";

export const CTASection = () => {
  return (
    <Section size="lg">
      <Container>
        <div className="flex flex-col items-center text-center gap-8 max-w-xl mx-auto">

          <H2 className="text-[2.2rem] md:text-[2.6rem] leading-[1.15]">
            Encuentra la fragancia que habla por ti.
          </H2>

          <Text>
            Descubre una selección diseñada para dejar una impresión duradera.
          </Text>

          <div className="pt-4">
            <a href="#perfumes">
            <Button className="px-10 py-4 text-base">
              Explorar colección
            </Button>
            </a>
          </div>

        </div>
      </Container>
    </Section>
  );
};