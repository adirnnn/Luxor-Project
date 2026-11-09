import { API_URL, NETWORK_ERROR_MESSAGE } from "./apiClient";

// SFTWRKEY-450: "Avísame cuando vuelva" para perfumes agotados
export type RestockAlertResult = {
  success: boolean;
  message: string;
};

async function post(path: string, body: object, fallback: string): Promise<RestockAlertResult> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return {
      success: res.ok && data?.success === true,
      message: data?.message || (res.ok ? "Listo." : fallback),
    };
  } catch {
    return { success: false, message: NETWORK_ERROR_MESSAGE };
  }
}

export const subscribeRestockAlert = (productId: string, email: string, consent: boolean) =>
  post("/restock-alerts", { productId, email, consent }, "No se pudo guardar el aviso. Intenta de nuevo.");

export const unsubscribeRestockAlerts = (token: string) =>
  post("/restock-alerts/unsubscribe", { token }, "No se pudieron cancelar los avisos. Intenta de nuevo.");
