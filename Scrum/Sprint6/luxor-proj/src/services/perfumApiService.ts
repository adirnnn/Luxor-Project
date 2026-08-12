const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type ExternalPerfumeCandidate = {
  name: string;
  brand: string;
  image: string;
  description: string;
  notes: {
    salida: string;
    corazon: string;
    fondo: string;
  };
  external_source: string;
  external_id: string | null;
  synced_at: string;
  warnings: string[];
};

export async function searchExternalPerfumes(query: string, brand?: string): Promise<ExternalPerfumeCandidate[]> {
  const params = new URLSearchParams({ q: query });
  if (brand) params.set('brand', brand);

  const res = await fetch(`${API_URL}/external-perfumes/search?${params.toString()}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message || 'No se pudo buscar en PerfumAPI.');
  }
  return body?.results ?? [];
}

export async function fetchExternalPerfumeBrands(): Promise<string[]> {
  const res = await fetch(`${API_URL}/external-perfumes/brands`);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message || 'No se pudieron obtener las marcas de PerfumAPI.');
  }
  return body?.brands ?? [];
}
