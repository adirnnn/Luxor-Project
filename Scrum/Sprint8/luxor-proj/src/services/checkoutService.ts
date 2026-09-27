import type { PaymentFormState } from "../validation/usePaymentForm";
import { API_URL, authHeaders } from "./apiClient";

export interface CheckoutError {
  code: "EMPTY_CART" | "INSUFFICIENT_STOCK" | "CARD_DECLINED" | "INVALID_PAYMENT_DATA" | "GATEWAY_ERROR" | "PAYMENT_ERROR" | "NETWORK_ERROR";
  message: string;
  items?: { product_id: string; name: string; disponible: number; solicitado: number }[];
  declineCode?: string;
}

export interface CheckoutSuccess {
  success: true;
  order: { id: number; total: number; created_at: string };
  payment: {
    id: number;
    status: string;
    brand: string;
    last4: string;
    authCode: string;
  };
}

export async function processCheckout(userId: number, card: PaymentFormState): Promise<CheckoutSuccess> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/checkout/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(card),
    });
  } catch {
    const err: CheckoutError = { code: "NETWORK_ERROR", message: "No hay conexión con el servidor. Revisa tu internet." };
    throw err;
  }

  const data = await res.json();

  if (!res.ok || !data.success) {
    const err: CheckoutError = {
      code: data.code || "PAYMENT_ERROR",
      message: data.message || "Ocurrió un error al procesar el pago.",
      items: data.items,
      declineCode: data.declineCode,
    };
    throw err;
  }

  return data;
}