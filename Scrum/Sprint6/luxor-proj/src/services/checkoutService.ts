const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface CheckoutError {
  code: "EMPTY_CART" | "INSUFFICIENT_STOCK" | "PAYMENT_ERROR" | "NETWORK_ERROR";
  message: string;
  items?: { product_id: string; name: string; disponible: number; solicitado: number }[];
}

export interface CheckoutSuccess {
  success: true;
  order: { id: number; total: number; created_at: string };
}

export async function processCheckout(userId: number): Promise<CheckoutSuccess> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/checkout/${userId}`, { method: "POST" });
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
    };
    throw err;
  }

  return data;
}