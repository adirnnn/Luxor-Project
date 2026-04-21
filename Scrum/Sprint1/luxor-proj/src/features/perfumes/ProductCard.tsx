import type { FC } from "react";
import { Link } from "react-router-dom";
import { Text, H3 } from "../../components/ui/Typography";
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
  return (
    <Link to={`/producto/${id}`}>
      <div
        className={clsx(
          "group cursor-pointer flex flex-col gap-4 transition-transform duration-300 hover:-translate-y-1",
          className
        )}
      >
        {/* Image */}
        <div className="relative overflow-hidden">
          <div className="aspect-[3/4] w-full overflow-hidden bg-primary-nude shadow-soft">
            <img
              src={image}
              alt={name}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1">
          <H3 className="text-base font-medium">{name}</H3>

          {description && (
            <Text className="text-sm text-secondary-brown/80">
              {description}
            </Text>
          )}

          <span className="text-sm text-primary-black tracking-wide font-medium mt-1">
            ${price.toFixed(2)}
          </span>
        </div>
      </div>
    </Link>
  );
};