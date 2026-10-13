import { API_URL } from "./apiClient";

// SFTWRKEY-428: recuperar contraseña
export type PasswordResetResult = {
  success: boolean;
  message: string;
  devResetUrl?: string;
};

async function post(path: string, body: object): Promise<PasswordResetResult> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return {
      success: res.ok && data?.success === true,
      message: data?.message || (res.ok ? "Listo." : "No se pudo completar la solicitud."),
      devResetUrl: data?.devResetUrl,
    };
  } catch {
    return { success: false, message: "No se pudo conectar con el servidor. Verifica tu conexión." };
  }
}

export const requestPasswordReset = (email: string) => post("/auth/forgot-password", { email });

export const resetPassword = (token: string, password: string) =>
  post("/auth/reset-password", { token, password });
