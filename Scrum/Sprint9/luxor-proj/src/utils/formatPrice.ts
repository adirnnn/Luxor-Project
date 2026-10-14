// Formato único de precios en quetzales: "Q390.00", "Q1,170.00".
// El backend manda los precios como texto ("390.00", columna NUMERIC), por eso se convierte primero.
const formatter = new Intl.NumberFormat("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatPrice(value: number | string | null | undefined): string {
  const amount = Number(value);
  return `Q${formatter.format(Number.isFinite(amount) ? amount : 0)}`;
}
