// SFTWRKEY-435: datos de la tienda que usan los títulos y las descripciones de las páginas.
export const SITE_NAME = "Perfumería Victoria";

export const SITE_DESCRIPTION =
  "Perfumes árabes y de diseñador originales, con certificado de autenticidad y envío a todo el país en 24 a 48 horas.";

type ProductForMeta = {
  name: string;
  brand?: string | null;
  price: number | string;
  notes?: { salida?: string | null; corazon?: string | null; fondo?: string | null } | null;
};

// "Lattafa · Salida: Canela. Corazón: Vainilla. Fondo: Ámbar. Q390.00"
// api/product-preview.ts arma la misma descripción para las vistas previas de redes sociales.
export function productDescription(product: ProductForMeta): string {
  const notes = [
    product.notes?.salida && `Salida: ${product.notes.salida}.`,
    product.notes?.corazon && `Corazón: ${product.notes.corazon}.`,
    product.notes?.fondo && `Fondo: ${product.notes.fondo}.`,
  ].filter(Boolean);
  const price = Number(product.price);
  return [
    product.brand ? `${product.brand} ·` : null,
    ...notes,
    Number.isFinite(price) ? `Q${price.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
