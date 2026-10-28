import { useId, useState, type FC } from "react";
import clsx from "clsx";
import { formatRating, reviewCountLabel, toAverage } from "./rating";

// SFTWRKEY-431: estrellas de calificación (solo lectura y para elegir) y el resumen promedio + cantidad.

const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z";

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={clsx("shrink-0", className)} fill="currentColor">
      <path d={STAR_PATH} />
    </svg>
  );
}

type StarsProps = {
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-6 h-6" };

// Estrellas de solo lectura. Las doradas se recortan al porcentaje del promedio (4.5 = 90%).
export const Stars: FC<StarsProps> = ({ value, size = "md", className }) => {
  const percent = (Math.min(Math.max(value, 0), 5) / 5) * 100;
  const star = SIZES[size];
  return (
    <span
      role="img"
      aria-label={`${formatRating(value)} de 5 estrellas`}
      className={clsx("relative inline-flex", className)}
    >
      <span className="flex gap-0.5 text-white/15">
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} className={star} />)}
      </span>
      <span className="absolute inset-0 flex gap-0.5 overflow-hidden text-primary-gold" style={{ width: `${percent}%` }}>
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} className={star} />)}
      </span>
    </span>
  );
};

type RatingSummaryProps = {
  average: number | string | null | undefined;
  count: number | null | undefined;
  size?: "sm" | "md" | "lg";
  // en la tarjeta no se muestra nada si el perfume todavía no tiene reseñas
  hideWhenEmpty?: boolean;
  className?: string;
};

// "★★★★½ 4.5 (12 reseñas)"
export const RatingSummary: FC<RatingSummaryProps> = ({ average, count, size = "md", hideWhenEmpty = false, className }) => {
  const avg = toAverage(average);
  const total = count ?? 0;

  if (avg === null || total === 0) {
    if (hideWhenEmpty) return null;
    return <span className={clsx("text-xs italic text-primary-champagne/40", className)}>Aún sin reseñas</span>;
  }

  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <Stars value={avg} size={size} />
      <span className={clsx("font-bold text-primary-champagne", size === "lg" ? "text-base" : "text-xs")}>{formatRating(avg)}</span>
      <span className={clsx("text-primary-champagne/50", size === "lg" ? "text-sm" : "text-xs")}>({reviewCountLabel(total)})</span>
    </span>
  );
};

const LABELS = ["Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

type StarInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

// Para elegir de 1 a 5. Son radios de verdad: se usa con teclado (flechas) y con lector de pantalla.
export const StarInput: FC<StarInputProps> = ({ value, onChange, disabled = false }) => {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-xs text-primary-champagne/60 uppercase tracking-widest mb-2">Tu calificación</legend>
      <div className="flex items-center gap-3">
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              onMouseEnter={() => setHover(n)}
              className={clsx(
                "cursor-pointer rounded transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-gold",
                n <= shown ? "text-primary-gold" : "text-white/20",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="sr-only"
              />
              <Star className="w-7 h-7" />
              <span className="sr-only">{n === 1 ? "1 estrella" : `${n} estrellas`} · {LABELS[n - 1]}</span>
            </label>
          ))}
        </div>
        <span className="text-xs text-primary-champagne/60" aria-hidden="true">
          {shown ? LABELS[shown - 1] : "Elige de 1 a 5"}
        </span>
      </div>
    </fieldset>
  );
};
