import { type FC } from "react";
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
    <Section size="lg" className="py-24">
      <Container>
        <div className="grid md:grid-cols-2 gap-16 md:gap-32 items-center">

          <div className="flex flex-col gap-10 max-w-2xl md:order-2">
            <span className="text-sm tracking-[0.4em] uppercase text-primary-gold font-black">Habibi Exclusive</span>
            <div className="flex flex-col gap-4">
              <H1 className="leading-none tracking-tighter uppercase italic">{name}</H1>
              <span className="text-4xl font-black tracking-tight text-primary-gold">Q{price}.00</span>
            </div>
            
            <Text className="max-w-xl text-xl md:text-2xl leading-tight text-primary-champagne/60 font-medium">{description}</Text>
            
            <div className="flex flex-col gap-6 py-8 border-y border-white/5">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-primary-gold uppercase tracking-[0.3em]">Salida</span>
                <span className="text-lg text-primary-champagne font-bold">{notes.salida}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-primary-gold uppercase tracking-[0.3em]">Corazón</span>
                <span className="text-lg text-primary-champagne font-bold">{notes.corazon}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-primary-gold uppercase tracking-[0.3em]">Fondo</span>
                <span className="text-lg text-primary-champagne font-bold">{notes.fondo}</span>
              </div>
            </div>

            <div className="pt-8">
              <Button 
                onClick={() => addToCart({ id, name, price, image, description, notes })}
                className="w-full md:w-auto px-20 py-6 shadow-[0_20px_60px_rgba(224,179,84,0.3)]"
              >
                AGREGAR AL CARRITO
              </Button>
            </div>
          </div>

          <div className="relative md:order-1">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-white/5 bg-primary-black group">
              <img src={image} alt={name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
              <div className="absolute inset-0 cinematic-overlay opacity-30 pointer-events-none" />
            </div>
          </div>

        </div>
      </Container>
    </Section>
  );
};
