// PerfumAPI no expone un endpoint de marcas dedicado (vean docs/PERFUM_API.md, seccion "Modelo de datos"): la marca es solo un campo de cada perfume.
// este modulo pagina /perfumes una vez, deduplica brand y cachea el resultado en memoria por un rato corto para alimentar un filtro opcional de marca en el buscador del admin, sin pegarle a PerfumAPI en cada tecla.
import { fetchExternalPerfumesPage } from './perfumApiClient.js';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const PAGE_SIZE = 100;

let cache = { brands: null, fetchedAt: 0 };

async function fetchAllPerfumes() {
  const first = await fetchExternalPerfumesPage(PAGE_SIZE, 0);
  const all = [...first.perfumes];
  const total = first.total;

  let offset = PAGE_SIZE;
  while (offset < total) {
    const page = await fetchExternalPerfumesPage(PAGE_SIZE, offset);
    all.push(...page.perfumes);
    offset += PAGE_SIZE;
  }
  return all;
}

/**
 * devuelve la lista ordenada de marcas conocidas por PerfumAPI, cacheada
 * en memoria por CACHE_TTL_MS para no repaginar todo el catalogo en cada
 * busqueda del admin.
 */
export async function getKnownBrands({ forceRefresh = false } = {}) {
  const isFresh = cache.brands && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (isFresh && !forceRefresh) return cache.brands;

  const perfumes = await fetchAllPerfumes();
  const brands = [...new Set(perfumes.map((p) => p.brand).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  cache = { brands, fetchedAt: Date.now() };
  return brands;
}
