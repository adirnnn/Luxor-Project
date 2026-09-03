export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const TOKEN_KEY = "luxor-auth-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// Cabeceras de autenticación para las rutas protegidas del backend (JWT en el login).
export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
