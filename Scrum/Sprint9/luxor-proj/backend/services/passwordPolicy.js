// SFTWRKEY-409 Política de contraseñas segura

// Longitud mínima de contraseña recomendada por OWASP
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_BYTES = 72;

export function validarPassword(password) {
    if (typeof password !== "string") {
        return "La contraseña debe ser un texto válido.";
    }

    const cantidadCaracteres = Array.from(password).length;

    if (cantidadCaracteres < MIN_PASSWORD_LENGTH) {
        return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }

    if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
        return `La contraseña no debe superar ${MAX_PASSWORD_BYTES} bytes.`;
    }

    return null;
}
