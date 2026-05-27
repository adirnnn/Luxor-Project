const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  stock?: number;
  notes: {
    salida: string;
    corazon: string;
    fondo: string;
  };
}

// SFTWRKEY-252: Cache en memoria para evitar requests repetidos
const cache: { products?: Product[]; byId: Record<string, Product> } = { byId: {} };

export async function fetchProducts(): Promise<Product[]> {
  if (cache.products) return cache.products;
  const res = await fetch(`${API_URL}/products`);
  if (!res.ok) throw new Error('Error al obtener productos');
  const data: Product[] = await res.json();
  cache.products = data;
  // Poblar también el cache por ID
  data.forEach(p => { cache.byId[p.id] = p; });
  return data;
}

export async function fetchProductById(id: string): Promise<Product> {
  // SFTWRKEY-246 + SFTWRKEY-252: Usar cache si ya tenemos el producto
  if (cache.byId[id]) return cache.byId[id];
  const res = await fetch(`${API_URL}/products/${id}`);
  if (!res.ok) throw new Error('Producto no encontrado');
  const data: Product = await res.json();
  cache.byId[id] = data;
  return data;
}

export function clearProductCache() {
  cache.products = undefined;
  Object.keys(cache.byId).forEach(k => delete cache.byId[k]);
}

export async function createProduct(product: Product): Promise<void> {
  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) throw new Error('Error al crear producto');
  clearProductCache(); // Invalidar cache al crear
}

export async function updateProduct(id: string, product: Partial<Product>): Promise<void> {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) throw new Error('Error al actualizar producto');
  clearProductCache(); // Invalidar cache al actualizar
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Error al eliminar producto');
  clearProductCache(); // Invalidar cache al eliminar
}