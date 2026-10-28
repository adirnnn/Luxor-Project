import type { PaymentFormState } from "../validation/usePaymentForm";
import { API_URL } from "./apiClient";
import type { Delivery } from "../utils/shipping";

// SFTWRKEY-445: el pago se hace en la página de Recurrente. La tienda abre el pago, manda al
// cliente a Recurrente y al volver confirma con el backend si el cobro quedó aprobado.

export interface CheckoutError {
  code: "EMPTY_CART" | "INSUFFICIENT_STOCK" | "AMOUNT_TOO_LOW" | "GATEWAY_ERROR" | "GATEWAY_NOT_CONFIGURED" | "PAYMENT_ERROR" | "NETWORK_ERROR"
    // SFTWRKEY-432: el cupón no sirvió al abrir el pago (vencido, agotado, inventado, ya usado o sin la compra mínima)
    | "COUPON_NOT_FOUND" | "COUPON_EXPIRED" | "COUPON_EXHAUSTED" | "COUPON_ALREADY_USED" | "COUPON_MIN_PURCHASE";
  message: string;
  items?: { product_id: string; name: string; disponible: number; solicitado: number }[];
}

export interface CheckoutStarted {
  checkoutUrl: string;
  reference: string;
}

export interface PaymentResult {
  status: "pagado" | "pendiente" | "cancelado";
  guest?: boolean;
  failureReason?: string | null;
  order?: {
    id: number;
    total: number;
    created_at: string;
    items: { name: string; quantity: number; price: number }[];
    // SFTWRKEY-449
    shipping: number;
    delivery: Delivery | null;
    // SFTWRKEY-432: lo que se descontó con el cupón (el total ya viene rebajado)
    discount?: number;
    coupon?: string | null;
  };
  payment?: { brand: string | null; last4: string | null } | null;
}

async function post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    const err: CheckoutError = { code: "NETWORK_ERROR", message: "No hay conexión con el servidor. Revisa tu internet." };
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err: CheckoutError = {
      code: data.code || "PAYMENT_ERROR",
      message: data.message || "Ocurrió un error al procesar el pago.",
      items: data.items,
    };
    throw err;
  }
  return data as T;
}

// Abre el pago del carrito del usuario con sesión (SFTWRKEY-451: la sesión va en la cookie).
// SFTWRKEY-432: del cupón solo se manda el código; el descuento lo calcula el backend.
export const startCheckout = (userId: number, address: PaymentFormState, couponCode: string | null = null) =>
  post<CheckoutStarted>(`/checkout/${userId}`, couponCode ? { ...address, couponCode } : address);

export const isCouponError = (err: CheckoutError | null) => Boolean(err?.code?.startsWith("COUPON_"));

// Al volver de Recurrente: ¿quedó pagado?
export const confirmPayment = (reference: string) =>
  post<PaymentResult>("/checkout/confirm", { reference });

// Cuando el cliente se sale de Recurrente sin pagar: libera el stock apartado
export const cancelPayment = (reference: string) =>
  post<PaymentResult>("/checkout/cancel", { reference });
