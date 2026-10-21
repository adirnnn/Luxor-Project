// cliente read only para la instancia publica de PerfumAPI.
// lean docs/PERFUM_API.md para el detalle de la investigacion (URL real, endpoints, por que el timeout es tan alto, etc.)
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.PERFUM_API_BASE_URL || 'https://perfumapidatabase.onrender.com';

// el servicio corre en el free tier de Render: si estaba dormido, la primera peticion puede tardar 30-60s en responder mientras despierta.
const REQUEST_TIMEOUT_MS = 60_000;

class PerfumApiError extends Error {
  constructor(message, { cause, status } = {}) {
    super(message);
    this.name = 'PerfumApiError';
    this.status = status ?? null;
    if (cause) this.cause = cause;
  }
}

async function fetchJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new PerfumApiError(`PerfumAPI respondio con estado ${res.status}`, { status: res.status });
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new PerfumApiError('PerfumAPI no respondio a tiempo (posible cold start de Render).', { cause: err });
    }
    if (err instanceof PerfumApiError) throw err;
    throw new PerfumApiError('No se pudo conectar con PerfumAPI.', { cause: err });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * busca perfumes por termino libre (nombre, marca, etc).
 * @param {string} query
 * @param {number} limit
 */
export async function searchExternalPerfumes(query, limit = 25) {
  if (!query || !query.trim()) return [];
  const encoded = encodeURIComponent(query.trim());
  const data = await fetchJson(`/perfumes/search/${encoded}?limit=${limit}`);
  return Array.isArray(data) ? data : [];
}

/**
 * trae una pagina de perfumes crudos (usado por getKnownBrands, ver perfumBrands.js).
 */
export async function fetchExternalPerfumesPage(limit = 100, offset = 0) {
  const data = await fetchJson(`/perfumes?limit=${limit}&offset=${offset}`);
  return {
    total: data?.total ?? 0,
    perfumes: Array.isArray(data?.perfumes) ? data.perfumes : [],
  };
}

export { PerfumApiError, BASE_URL as PERFUM_API_BASE_URL };
