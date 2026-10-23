import { API_URL } from "./apiClient";
import type { Product } from "./productService";

// SFTWRKEY-424: catálogo paginado y filtrado desde el backend
export type CatalogFilters = {
  q?: string;
  brand?: string;
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export type CatalogPage = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function fetchCatalog(filters: CatalogFilters = {}): Promise<CatalogPage> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });
  const res = await fetch(`${API_URL}/products/catalog?${params.toString()}`);
  if (!res.ok) throw new Error("Error al obtener el catálogo");
  return res.json();
}

export async function fetchBrands(): Promise<string[]> {
  const res = await fetch(`${API_URL}/products/brands`);
  if (!res.ok) throw new Error("Error al obtener marcas");
  const data = await res.json();
  return data.brands;
}

// SFTWRKEY-430: perfumes parecidos al que se está viendo
export async function fetchRelatedProducts(id: string, limit = 4): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products/${encodeURIComponent(id)}/related?limit=${limit}`);
  if (!res.ok) throw new Error("Error al obtener productos relacionados");
  const data = await res.json();
  return data.items;
}
