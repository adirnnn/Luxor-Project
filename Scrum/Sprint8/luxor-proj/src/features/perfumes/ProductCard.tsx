import React, { type FC } from "react";
import { Link } from "react-router-dom";
import { Text, H3 } from "../../components/ui/Typography";
import { useCart } from "../../context/CartContext";
import clsx from "clsx";

export type ProductCardProps = {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
  className?: string;
};

export const ProductCard: FC<ProductCardProps> = ({
  id,
  name,
  price,
  image,
  description,
  className,
}) => {
  const { addToCart } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({ 
      id, 
      name, 
      price, 
      image, 
      description: description || "", 
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
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          </div>
          
          {/* Quick Add Overlay */}
          <button 
            onClick={handleAddToCart}
            className="absolute bottom-6 left-6 right-6 py-4 bg-primary-gold text-primary-black text-xs font-black uppercase tracking-[0.2em] opacity-0 translate-y-4 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0 rounded-button shadow-2xl z-10 hover:bg-primary-champagne"
          >
            Agregar
          </button>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-3 px-1 mt-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <H3 className="text-lg md:text-xl font-light tracking-tight leading-none text-primary-champagne truncate max-w-[70%]">{name}</H3>
            <span className="text-xl md:text-2xl font-light text-primary-gold shrink-0">
              Q{price}
            </span>
          </div>

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