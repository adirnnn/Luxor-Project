// SFTWRKEY-409: misma política que backend/services/passwordPolicy.js, para avisar antes de enviar.
// Solo para contraseñas nuevas (registro, cambio y recuperación); el login no la usa.
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_BYTES = 72;

export const PASSWORD_HINT = `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`;

export function validatePassword(password: string): string | null {
  if (Array.from(password).length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `La contraseña es demasiado larga (máximo ${MAX_PASSWORD_BYTES} bytes).`;
  }
  return null;
}
