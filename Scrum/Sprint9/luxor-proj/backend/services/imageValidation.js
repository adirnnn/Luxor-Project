// SFTWRKEY-379: la imagen de un producto solo puede ser una ruta local ("/images/x.png")
// o una URL https. Se rechazan javascript:, data:, http: y rutas "//host" (protocol-relative).
export const IMAGE_ERROR_MESSAGE = "La imagen debe ser una ruta local (/...) o una URL https.";

const LOCAL_PATH_REGEX = /^\/(?![/\\])[^\s\\]*$/;

export function isSafeImage(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string" || value.length > 500) return false;
  if (LOCAL_PATH_REGEX.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
