import type { ReactNode } from "react";
import clsx from "clsx";

type Props = {
  children: ReactNode;
  className?: string;
};

export const H1 = ({ children, className }: Props) => (
  <h1 className={clsx("text-5xl sm:text-6xl md:text-h1 font-heading font-light uppercase tracking-tight", className)}>
    {children}
  </h1>
);

export const H2 = ({ children, className }: Props) => (
  <h2 className={clsx("text-3xl sm:text-4xl md:text-h2 font-heading font-light uppercase tracking-wide", className)}>
    {children}
  </h2>
);

export const H3 = ({ children, className }: Props) => (
  <h3 className={clsx("text-xl md:text-h3 font-heading font-medium uppercase tracking-widest", className)}>
    {children}
  </h3>
);

export const Text = ({ children, className }: Props) => (
  <p className={clsx("text-lg md:text-body font-normal leading-relaxed italic text-primary-champagne/60", className)}>
    {children}
  </p>
);