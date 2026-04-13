import type { ReactNode } from "react";
import clsx from "clsx";

type Props = {
  children: ReactNode;
  className?: string;
};

export const H1 = ({ children, className }: Props) => (
  <h1 className={clsx("text-h1", className)}>{children}</h1>
);

export const H2 = ({ children, className }: Props) => (
  <h2 className={clsx("text-h2", className)}>{children}</h2>
);

export const H3 = ({ children, className }: Props) => (
  <h3 className={clsx("text-h3", className)}>{children}</h3>
);

export const Text = ({ children, className }: Props) => (
  <p className={clsx("text-body text-secondary-brown", className)}>
    {children}
  </p>
);