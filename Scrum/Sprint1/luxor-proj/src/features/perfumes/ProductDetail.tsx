import type { FC } from "react";
import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";

export type ProductDetailProps = {
  name: string;
  price: number;
  image: string;
  description: string;
  notes: {
    salida: string;
    corazon: string;
    fondo: string;
  };
};

export const ProductDetail: FC<ProductDetailProps> = ({
  name,
  price,
  image,
  description,
  notes,
}) => {
  return (
    <Section size="lg">
      <Container>
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">

          {/* Image */}
          <div className="relative md:-ml-12">
            <div className="relative h-[480px] md:h-[620px] overflow-hidden shadow-soft md:rounded-none rounded-xl">
              <img
                src={image}
                alt={name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-8 max-w-xl">

            {/* Brand label */}
            <span className="text-xs tracking-[0.25em] uppercase text-secondary-brown">
              Joyero Árabe
            </span>

            {/* Title + Price */}
            <div className="flex flex-col gap-3">
              <H2 className="text-[2.2rem] md:text-[2.6rem] leading-[1.05] tracking-tight">
                {name}
              </H2>

              <span className="text-xl font-medium tracking-wide text-primary-black">
                ${price.toFixed(2)}
              </span>
            </div>

            {/* Description */}
            <Text className="max-w-sm leading-relaxed">
              {description}
            </Text>

            {/* Notes */}
            <div className="flex flex-col gap-3 text-sm text-secondary-brown">
              <div className="flex gap-2">
                <span className="font-medium text-primary-black">Salida:</span>
                <span>{notes.salida}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-primary-black">Corazón:</span>
                <span>{notes.corazon}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-primary-black">Fondo:</span>
                <span>{notes.fondo}</span>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-6 md:pt-8">
              <Button className="px-10 py-4 text-base">
                Comprar
              </Button>
            </div>

          </div>

        </div>
      </Container>
    </Section>
  );
};