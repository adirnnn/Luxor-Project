import { API_URL } from "./apiClient";

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  stock?: number;
  category_id?: number | null;
  category_name?: string | null;
  brand?: string | null;
  external_source?: string | null;
  external_id?: string | null;
  synced_at?: string | null;
  notes: {
    salida: string;
    corazon: string;
    fondo: string;
  };
}

export type Category = {
  id: number;
  nombre: string;
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products`);
  if (!res.ok) throw new Error('Error al obtener productos');
  return res.json();
}

// SFTWRKEY-275: Traer categorías disponibles para el filtro de la UI
export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories`);
  if (!res.ok) throw new Error('Error al obtener categorías');
  const data = await res.json();
  return data.categories;
}

// SFTWRKEY-423: el detalle distingue "el perfume no existe" (404) de un error del servidor
export class ProductNotFoundError extends Error {
  constructor() {
    super('Producto no encontrado');
    this.name = 'ProductNotFoundError';
  }
}

export async function fetchProductById(id: string): Promise<Product> {
  const res = await fetch(`${API_URL}/products/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new ProductNotFoundError();
  if (!res.ok) throw new Error('No se pudo cargar el producto. Intenta de nuevo más tarde.');
  return res.json();
}

export async function createProduct(product: Product): Promise<void> {
  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || 'Error al crear producto');
  }
}

// SFTWRKEY-457: el backend pasa la foto a WebP de 800 px y devuelve su ruta (/product-images/<id>.webp)
export const FOTO_TIPOS = ['image/png', 'image/jpeg', 'image/webp'];
export const FOTO_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadProductImage(file: File): Promise<string> {
  const res = await fetch(`${API_URL}/admin/product-images`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.image) {
    throw new Error(body?.message || 'No se pudo subir la foto.');
  }
  return body.image;
}

export async function updateProduct(id: string, product: Partial<Product>): Promise<void> {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || 'Error al actualizar producto');
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar producto');
}