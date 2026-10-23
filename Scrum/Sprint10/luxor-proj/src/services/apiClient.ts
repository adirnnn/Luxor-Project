export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const TOKEN_KEY = "luxor-auth-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// SFTWRKEY-423: cuando el backend no responde, fetch lanza un TypeError ("Failed to fetch").
// Ese texto técnico nunca se muestra: se cambia por un mensaje para el cliente.
export const NETWORK_ERROR_MESSAGE =
  "No pudimos conectar con la tienda. Revisa tu conexión e intenta de nuevo en unos minutos.";

export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  return err instanceof Error && err.message ? err.message : fallback;
}

// Cabeceras de autenticación para las rutas protegidas del backend (JWT en el login).
export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
