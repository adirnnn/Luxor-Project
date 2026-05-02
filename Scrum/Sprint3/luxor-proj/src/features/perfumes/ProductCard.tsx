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
    <div className={clsx("group relative flex flex-col gap-4 p-3 bg-white/50 rounded-2xl border border-transparent hover:border-primary-beige hover:bg-white hover:shadow-soft transition-all duration-300", className)}>
      <Link to={`/producto/${id}`} className="flex flex-col gap-4">
        {/* Image */}
        <div className="relative overflow-hidden rounded-xl bg-primary-nude shadow-sm">
          <div className="aspect-[3/4] w-full overflow-hidden">
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          </div>
          
          {/* Quick Add Overlay */}
          <button 
            onClick={handleAddToCart}
            className="absolute bottom-4 left-4 right-4 py-3 bg-primary-black/90 text-white text-[10px] font-bold uppercase tracking-widest opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 backdrop-blur-sm hover:bg-primary-gold hover:text-primary-black z-10"
          >
            Agregar al Carrito
          </button>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 px-1">
          <div className="flex justify-between items-start gap-2">
            <H3 className="text-sm font-medium leading-tight">{name}</H3>
            <span className="text-sm text-primary-black font-semibold shrink-0">
              Q{price}
            </span>
          </div>

          {description && (
            <Text className="text-[10px] text-secondary-brown/80 line-clamp-1 mt-1">
              {description}
            </Text>
          )}
        </div>
      </Link>
    </div>
  );
};
