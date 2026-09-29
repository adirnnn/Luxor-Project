import type { Product } from "../services/productService";

// SFTWRKEY-391: tope de unidades por producto (el backend aplica el mismo límite en /cart).
export const MAX_QTY_PER_ITEM = 10;

// Máximo que se puede tener de un producto: su stock real, sin pasar de MAX_QTY_PER_ITEM.
// Si el stock no se conoce, el checkout del backend lo valida al pagar.
export function maxQuantityFor(product: Pick<Product, "stock">): number {
  if (product.stock === undefined || product.stock === null) return MAX_QTY_PER_ITEM;
  const stock = Math.floor(Number(product.stock));
  if (Number.isNaN(stock)) return MAX_QTY_PER_ITEM;
  return Math.max(0, Math.min(stock, MAX_QTY_PER_ITEM));
}
