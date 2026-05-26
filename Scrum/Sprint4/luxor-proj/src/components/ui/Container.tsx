import type { ReactNode } from "react";
import clsx from "clsx";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

export const Container = ({ children, className }: ContainerProps) => {
  return (
    <div className={clsx("max-w-content mx-auto px-4 md:px-6", className)}>
      {children}
    </div>
  );
};