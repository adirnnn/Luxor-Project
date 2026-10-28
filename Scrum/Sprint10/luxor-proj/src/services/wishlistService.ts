import { API_URL } from "./apiClient";
import type { Product } from "./productService";

// SFTWRKEY-429: lista de deseos (requiere sesión)
export async function fetchWishlist(userId: number | string): Promise<Product[]> {
  const res = await fetch(`${API_URL}/wishlist/${userId}`);
  if (!res.ok) throw new Error("Error al obtener la lista de deseos");
  const data = await res.json();
  return data.items;
}

export async function addToWishlist(userId: number | string, productId: string): Promise<void> {
  const res = await fetch(`${API_URL}/wishlist/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  if (!res.ok) throw new Error("Error al agregar a la lista de deseos");
}

export async function removeFromWishlist(userId: number | string, productId: string): Promise<void> {
  const res = await fetch(`${API_URL}/wishlist/${userId}/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Error al quitar de la lista de deseos");
}
