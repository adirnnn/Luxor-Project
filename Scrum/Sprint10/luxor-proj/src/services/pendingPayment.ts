import { cancelPayment } from "./checkoutService";

// Al abrir el pago la tienda aparta el stock 30 minutos. Si el cliente vuelve a la tienda sin pasar
// por "Salir sin pagar" (botón atrás del navegador, escribe la dirección, un enlace), ese apartado se
// quedaba hasta que vencía y un perfume con 1 unidad se veía agotado. Ahora la tienda recuerda el
// pago abierto y lo libera en cuanto el cliente regresa. El backend le pregunta antes a Recurrente:
// si sí se pagó, crea el pedido; si el pago está en curso, no lo toca.
const KEY = "luxor_pago_abierto";

// páginas a las que Recurrente regresa: ellas mismas confirman o cancelan el pago
const PAGINAS_DE_REGRESO = ["/pago/resultado", "/pago/cancelado"];

export function rememberPendingPayment(reference: string) {
  try {
    sessionStorage.setItem(KEY, reference);
  } catch {
    // sin almacenamiento: el apartado se libera solo al vencer, como antes
  }
}

export function forgetPendingPayment() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nada que borrar
  }
}

const pendingReference = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

let liberando = false;

// devuelve true si había un pago abierto y se mandó a liberar
export async function releasePendingPayment(pathname: string): Promise<boolean> {
  const reference = pendingReference();
  if (!reference || liberando) return false;
  if (PAGINAS_DE_REGRESO.includes(pathname)) {
    forgetPendingPayment();
    return false;
  }
  liberando = true;
  try {
    const resultado = await cancelPayment(reference);
    // pagado o cancelado: ya no hay nada abierto. "pendiente" = el pago sigue en curso en
    // Recurrente; se deja para que lo cierre su regreso o la revisión de pagos vencidos.
    if (resultado.status !== "pendiente") forgetPendingPayment();
    return true;
  } catch {
    // sin conexión: se intenta otra vez en la siguiente página
    return false;
  } finally {
    liberando = false;
  }
}
