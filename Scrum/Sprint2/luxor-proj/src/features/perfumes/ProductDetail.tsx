import React, { type FC } from "react";
import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { useCart } from "../../context/CartContext";

export type ProductDetailProps = {
  id: string;
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
  id,
  name,
  price,
  image,
  description,
  notes,
}) => {
  const { addToCart } = useCart();

  return (
    <Section size="lg">
      <Container>
        <div className="grid md:grid-cols-2 gap-8 md:gap-24 items-center">

          <div className="flex flex-col gap-8 max-w-xl md:order-2">
            <span className="text-xs tracking-[0.25em] uppercase text-secondary-brown">Joyero Árabe</span>
            <div className="flex flex-col gap-3">
              <H2 className="leading-[1.05] tracking-tight">{name}</H2>
              <span className="text-xl font-medium tracking-wide text-primary-black">Q{price}.00</span>
            </div>
            <Text className="max-w-sm leading-relaxed">{description}</Text>
            
            <div className="flex flex-col gap-3 text-sm text-secondary-brown">
              <div className="flex gap-2"><span className="font-medium text-primary-black">Salida:</span><span>{notes.salida}</span></div>
              <div className="flex gap-2"><span className="font-medium text-primary-black">Corazón:</span><span>{notes.corazon}</span></div>
              <div className="flex gap-2"><span className="font-medium text-primary-black">Fondo:</span><span>{notes.fondo}</span></div>
            </div>

            <div className="pt-6 md:pt-8">
              <Button 
                onClick={() => addToCart({ id, name, price, image, description, notes })}
                className="px-10 py-4 text-base"
              >
                Agregar al Carrito
              </Button>
            </div>
          </div>

          <div className="relative md:order-1 md:-ml-12">
            <div className="relative h-[320px] sm:h-[420px] md:h-[620px] overflow-hidden shadow-soft md:rounded-none rounded-xl">
              <img src={image} alt={name} className="w-full h-full object-cover" />
            </div>
          </div>

        </div>
      </Container>
    </Section>
  );
};
