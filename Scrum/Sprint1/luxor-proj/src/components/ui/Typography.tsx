import type { ReactNode } from "react";
import clsx from "clsx";

type Props = {
  children: ReactNode;
  className?: string;
};

export const H1 = ({ children, className }: Props) => (
  <h1 className={clsx("text-[2rem] sm:text-[2.6rem] md:text-h1 font-heading", className)}>
    {children}
  </h1>
);

export const H2 = ({ children, className }: Props) => (
  <h2 className={clsx("text-[1.6rem] sm:text-[1.9rem] md:text-h2 font-heading", className)}>
    {children}
  </h2>
);

export const H3 = ({ children, className }: Props) => (
  <h3 className={clsx("text-[1.1rem] md:text-h3 font-heading", className)}>
    {children}
  </h3>
);

export const Text = ({ children, className }: Props) => (
  <p className={clsx("text-body text-secondary-brown", className)}>
    {children}
  </p>
);