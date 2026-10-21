import { useState, type FC } from "react";
import clsx from "clsx";

// SFTWRKEY-391: selector "− [n] +" para elegir cuántas unidades agregar o dejar en el carrito.
export type QuantitySelectorProps = {
  value: number;
  max: number;
  min?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  size?: "md" | "sm";
  className?: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export const QuantitySelector: FC<QuantitySelectorProps> = ({
  value,
  max,
  min = 1,
  onChange,
  disabled = false,
  size = "md",
  className,
}) => {
  // Texto del input mientras se escribe (null = mostrar value); se ajusta al rango al salir del campo.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? min : clamp(parsed, min, max);
    setDraft(null);
    if (next !== value) onChange(next);
  };

  const button = clsx(
    "flex items-center justify-center font-black text-primary-champagne/60 transition-all",
    "hover:text-primary-gold hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none",
    size === "sm" ? "w-9 h-9 text-lg" : "w-11 h-11 text-xl",
  );

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <div className="inline-flex w-fit items-center border border-primary-gold/30 rounded-full overflow-hidden">
        <button
          type="button"
          className={button}
          onClick={() => onChange(clamp(value - 1, min, max))}
          disabled={disabled || value <= min}
          aria-label="Disminuir cantidad"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label="Cantidad"
          min={min}
          max={max}
          value={draft ?? String(value)}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className={clsx(
            "bg-transparent text-center font-black text-primary-champagne tabular-nums outline-none",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            size === "sm" ? "w-9 text-base" : "w-12 text-base",
          )}
        />
        <button
          type="button"
          className={button}
          onClick={() => onChange(clamp(value + 1, min, max))}
          disabled={disabled || value >= max}
          aria-label="Aumentar cantidad"
        >
          +
        </button>
      </div>
      {!disabled && max > 0 && max <= 5 && (
        <span className="text-[11px] font-bold text-primary-champagne/50">
          Solo quedan {max} disponibles
        </span>
      )}
    </div>
  );
};
