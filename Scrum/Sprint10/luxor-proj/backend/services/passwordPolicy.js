// SFTWRKEY-409: política de contraseñas (OWASP ASVS 2.1). Se aplica cada vez que se crea o
// cambia una contraseña: registro, cambio desde Mi cuenta y recuperación. El login no la
// revisa, para que las cuentas viejas con contraseñas más cortas puedan seguir entrando.
export const MIN_PASSWORD_LENGTH = 12;
// bcrypt ignora lo que pase de 72 bytes: más largo daría una falsa sensación de seguridad
export const MAX_PASSWORD_BYTES = 72;

export function validatePassword(password) {
  if (typeof password !== 'string') return 'La contraseña debe ser un texto válido.';
  // Array.from cuenta emojis y acentos como un solo carácter
  if (Array.from(password).length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `La contraseña es demasiado larga (máximo ${MAX_PASSWORD_BYTES} bytes).`;
  }
  return null;
}
