const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

export async function fetchProductById(id: string): Promise<Product> {
  const res = await fetch(`${API_URL}/products/${id}`);
  if (!res.ok) throw new Error('Producto no encontrado');
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