import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variants: Record<Variant, string> = {
  primary: "bg-primary-gold text-primary-black hover:opacity-90",
  secondary:
    "border border-primary-gold text-primary-gold hover:bg-primary-gold hover:text-primary-black",
  ghost: "text-primary-black hover:text-primary-gold",
};

export const Button = ({
  variant = "primary",
  className,
  ...props
}: Props) => {
  return (
    <button
      className={clsx(
        "px-6 py-3 rounded-xl transition-all duration-200 text-sm tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};