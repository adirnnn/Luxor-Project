// SFTWRKEY-451: el navegador habla con el backend por el mismo dominio del sitio (/api).
// En Vercel lo reenvía el rewrite de vercel.json y en local el proxy de vite.config.ts.
// Así la cookie de sesión (httpOnly) es del mismo sitio y los navegadores no la bloquean.
// La sesión ya no se guarda en localStorage: fetch manda la cookie solo en cada petición.
export const API_URL = "/api";

// SFTWRKEY-423: cuando el backend no responde, fetch lanza un TypeError ("Failed to fetch").
// Ese texto técnico nunca se muestra: se cambia por un mensaje para el cliente.
export const NETWORK_ERROR_MESSAGE =
  "No pudimos conectar con la tienda. Revisa tu conexión e intenta de nuevo en unos minutos.";

export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  return err instanceof Error && err.message ? err.message : fallback;
}
