import type { ReactNode } from "react";
import clsx from "clsx";

type SectionSize = "sm" | "md" | "lg";

type SectionProps = {
  children: ReactNode;
  size?: SectionSize;
  className?: string;
} & React.HTMLAttributes<HTMLElement>;

const sizeStyles: Record<SectionSize, string> = {
  sm: "py-section-sm",
  md: "py-section-md",
  lg: "py-section-lg",
};

export const Section = ({
  children,
  size = "md",
  className,
  ...props
}: SectionProps) => {
  return (
    <section
      {...props}
      className={clsx(sizeStyles[size], className)}
    >
      {children}
    </section>
  );
};