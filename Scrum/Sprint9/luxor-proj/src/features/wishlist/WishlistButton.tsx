import type { FC, MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useWishlist } from "../../context/WishlistContext";

type Props = {
  productId: string;
  productName: string;
  // "icon": corazón sobre la tarjeta; "full": botón con texto para la página del producto
  variant?: "icon" | "full";
  className?: string;
};

const Heart = ({ filled }: { filled: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

// SFTWRKEY-429: corazón para guardar o quitar un perfume de la lista de deseos.
// Sin sesión manda al login y, al entrar, regresa a la misma página.
export const WishlistButton: FC<Props> = ({ productId, productName, variant = "icon", className }) => {
  const { hasSession, isWished, toggle } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const wished = isWished(productId);

  const handleClick = async (e: MouseEvent) => {
    // el botón vive dentro de un <Link>: que no navegue al producto
    e.preventDefault();
    e.stopPropagation();
    if (!hasSession) {
      navigate("/login", { state: { from: location } });
      return;
    }
    await toggle(productId);
  };

  const label = wished ? `Quitar ${productName} de la lista de deseos` : `Agregar ${productName} a la lista de deseos`;

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={wished}
        aria-label={label}
        className={clsx(
          "inline-flex items-center justify-center gap-3 px-8 py-4 rounded-button border text-xs font-black uppercase tracking-[0.2em] transition-colors",
          wished
            ? "border-primary-gold bg-primary-gold/10 text-primary-gold"
            : "border-white/20 text-primary-champagne hover:border-primary-gold hover:text-primary-gold",
          className
        )}
      >
        <Heart filled={wished} />
        {wished ? "En tu lista de deseos" : "Guardar en favoritos"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={wished}
      aria-label={label}
      className={clsx(
        "absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-primary-black/70 backdrop-blur transition-colors",
        wished ? "text-primary-gold" : "text-primary-champagne/80 hover:text-primary-gold",
        className
      )}
    >
      <Heart filled={wished} />
    </button>
  );
};
