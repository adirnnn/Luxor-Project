import { API_URL } from "./apiClient";

// confirmar el correo con el enlace que llegó, y pedir otro enlace (backend/routes/emailVerification.js)
export async function verifyEmail(token: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${API_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.success, message: data.message || "No se pudo confirmar el correo." };
  } catch {
    return { ok: false, message: "No hay conexión con el servidor. Intenta de nuevo." };
  }
}

export async function resendVerification(): Promise<{ ok: boolean; message: string; alreadyVerified?: boolean }> {
  try {
    const res = await fetch(`${API_URL}/auth/resend-verification`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) return { ok: false, message: "Ya pediste varios enlaces. Espera un rato y revisa tu correo (y spam)." };
    return { ok: res.ok && data.success, message: data.message || "No pudimos enviar el correo.", alreadyVerified: data.alreadyVerified };
  } catch {
    return { ok: false, message: "No hay conexión con el servidor. Intenta de nuevo." };
  }
}
