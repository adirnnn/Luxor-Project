import { useState, type FC } from "react";
import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H1, Text } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { useCart } from "../../context/CartContext";
import { maxQuantityFor } from "../../context/cartLimits";
import { QuantitySelector } from "../../components/ui/QuantitySelector";

export type ProductDetailProps = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  stock?: number;
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
  stock,
  notes,
}) => {
  const { addToCart } = useCart();
  // SFTWRKEY-391: cantidad a agregar de una vez (máximo: stock real, tope de 10).
  const [qty, setQty] = useState(1);
  const max = maxQuantityFor({ stock });
  const agotado = max === 0;

  const handleAdd = () => {
    const result = addToCart({ id, name, price, image, description, stock, notes }, qty);
    if (result.ok) setQty(1);
  };

  return (
    <Section className="pt-0 pb-24">
      <Container>
        <div
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] [grid-template-areas:'img_head'_'body_body'] gap-x-5 gap-y-10 items-center
                    md:grid-cols-2 md:[grid-template-areas:'img_text'] md:gap-32"
        >
          <div className="contents md:[grid-area:text] md:flex md:flex-col md:gap-10 md:max-w-2xl">

          <div className="[grid-area:head] flex flex-col gap-3 md:gap-10 max-w-2xl">
            <span className="text-[10px] md:text-sm tracking-[0.3em] md:tracking-[0.4em] uppercase text-primary-gold font-black">Habibi Exclusive</span>
            <div className="flex flex-col gap-2 md:gap-4">
              <H1 className="!text-[1.875rem] sm:!text-5xl md:!text-h1 leading-none tracking-tighter uppercase italic break-words md:break-normal">{name}</H1>
              <span className="text-2xl md:text-4xl font-black tracking-tight text-primary-gold">Q{price}.00</span>
            </div>
          </div>

          <div className="[grid-area:body] flex flex-col gap-10 max-w-2xl">
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

            <div className="pt-8 flex flex-col gap-5">
              <QuantitySelector value={Math.min(qty, Math.max(max, 1))} max={Math.max(max, 1)} onChange={setQty} disabled={agotado} />
              <Button 
                onClick={handleAdd}
                disabled={agotado}
                className="w-full md:w-auto px-20 py-6 shadow-[0_20px_60px_rgba(224,179,84,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {agotado ? "AGOTADO" : "AGREGAR AL CARRITO"}
              </Button>
            </div>
          </div>

          </div>

          <div className="[grid-area:img] relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl md:rounded-[40px] shadow-[0_20px_40px_rgba(0,0,0,0.6)] md:shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-white/5 bg-primary-black group">
              <img src={image} alt={name} fetchPriority="high" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
              <div className="absolute inset-0 cinematic-overlay opacity-30 pointer-events-none" />
            </div>
          </div>

        </div>
      </Container>
    </Section>
  );
};