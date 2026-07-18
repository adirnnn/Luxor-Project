import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "outline";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variants: Record<Variant, string> = {
  primary: "bg-primary-gold text-primary-black hover:bg-primary-champagne hover:scale-105 shadow-[0_10px_40px_rgba(224,179,84,0.3)] font-bold tracking-widest uppercase",
  secondary:
    "border-2 border-primary-gold text-primary-gold hover:bg-primary-gold hover:text-primary-black hover:scale-105 font-bold uppercase",
  ghost: "text-primary-champagne/80 hover:text-primary-gold hover:scale-110",
  outline: "border border-white/10 text-primary-champagne hover:bg-white hover:text-primary-black hover:scale-105",
};

export const Button = ({
  variant = "primary",
  className,
  ...props
}: Props) => {
  return (
    <button
      className={clsx(
        "px-10 py-5 rounded-button transition-all duration-500 ease-out text-base md:text-lg",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};