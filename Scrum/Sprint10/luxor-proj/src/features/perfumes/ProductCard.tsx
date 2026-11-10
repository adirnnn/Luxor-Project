import React, { type FC } from "react";
import { Link } from "react-router-dom";
import { Text, H3 } from "../../components/ui/Typography";
import { useCart } from "../../context/CartContext";
import clsx from "clsx";
import { WishlistButton } from "../wishlist/WishlistButton";
import { formatPrice } from "../../utils/formatPrice";
import { RatingSummary } from "../reviews/StarRating";

export type ProductCardProps = {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
  stock?: number;
  className?: string;
  // SFTWRKEY-457: las primeras tarjetas del catálogo se ven al abrir la página, no se cargan diferidas
  priority?: boolean;
  // SFTWRKEY-431: promedio y cantidad de reseñas visibles
  ratingAvg?: number | string | null;
  ratingCount?: number;
};

export const ProductCard: FC<ProductCardProps> = ({
  id,
  name,
  price,
  image,
  description,
  stock,
  className,
  priority = false,
  ratingAvg,
  ratingCount,
}) => {
  const { addToCart } = useCart();
  // SFTWRKEY-450: los agotados salen al final del catálogo; desde su ficha se pide el aviso
  const agotado = typeof stock === "number" && stock <= 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({ 
      id, 
      name, 
      price, 
      image, 
      description: description || "", 
      stock,
      notes: { salida: "", corazon: "", fondo: "" } 
    });
  };

  return (
    <div className={clsx(
        "group relative flex flex-col gap-5 p-4 glass-card border-none hover:scale-[1.02]",
        "transition-all duration-500 ease-out", className)}>
          
      <Link to={`/producto/${id}`} className="flex flex-col gap-6">
        {/* Image */}
        <div className="relative overflow-hidden rounded-2xl bg-primary-black shadow-2xl">
          <div className="aspect-[4/5] w-full overflow-hidden">
            <img
              src={image}
              alt={name}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              className={clsx(
                "w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110",
                agotado && "opacity-60 grayscale-[40%]"
              )}
            />
          </div>

          {/* en móvil la etiqueta va abajo para no chocar con el corazón de favoritos */}
          {agotado && (
            <span className="absolute bottom-3 left-3 z-10 rounded-full border border-status-error/60 bg-primary-black/85 px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-status-error md:bottom-auto md:top-4 md:left-4 md:px-3 md:tracking-[0.15em]">
              Agotado
            </span>
          )}

          {/* SFTWRKEY-429: lista de deseos */}
          <WishlistButton productId={id} productName={name} />

          {/* Quick Add Overlay. Agotado: no se agrega; el enlace lleva a la ficha para pedir el aviso */}
          {agotado ? (
            <span className="absolute bottom-6 left-6 right-6 py-4 text-center bg-primary-black/80 border border-primary-gold text-primary-gold text-xs font-black uppercase tracking-[0.2em] opacity-0 translate-y-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0 rounded-button shadow-2xl z-10">
              Avísame cuando vuelva
            </span>
          ) : (
            <button
              onClick={handleAddToCart}
              className="absolute bottom-6 left-6 right-6 py-4 bg-primary-gold text-primary-black text-xs font-black uppercase tracking-[0.2em] opacity-0 translate-y-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0 rounded-button shadow-2xl z-10 hover:bg-primary-champagne"
            >
              Agregar
            </button>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-3 px-1 mt-auto">
          <div className="flex flex-col items-start gap-2">
            {/* el nombre completo (marca y perfume) usa todo el ancho y hasta 2 líneas, el precio va abajo:
                junto al precio se cortaba y solo se leía la marca ("LATTAFA ...") */}
            <H3 className="w-full min-h-[2.5em] text-lg md:text-xl font-light tracking-tight leading-tight text-primary-champagne line-clamp-2 break-words">{name}</H3>
            <span className="text-xl md:text-2xl font-light text-primary-gold shrink-0">
              {formatPrice(price)}
            </span>
          </div>

          {/* SFTWRKEY-431: sin reseñas no se muestra nada */}
          <RatingSummary average={ratingAvg} count={ratingCount} size="sm" hideWhenEmpty />

          {description && (
            <Text className="text-sm text-primary-champagne/40 line-clamp-1 font-normal italic">
              {description}
            </Text>
          )}
        </div>
      </Link>
    </div>
  );
};