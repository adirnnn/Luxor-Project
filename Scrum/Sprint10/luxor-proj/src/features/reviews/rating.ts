// SFTWRKEY-431: formato del promedio y la cantidad de reseñas
const ratingFormat = new Intl.NumberFormat("es-GT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// el backend manda el promedio como texto ("4.50", columna NUMERIC)
export function toAverage(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 5) : null;
}

export const formatRating = (value: number) => ratingFormat.format(value);

export const reviewCountLabel = (count: number) => (count === 1 ? "1 reseña" : `${count} reseñas`);
