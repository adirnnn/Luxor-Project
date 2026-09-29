// alertas de seguridad (admin)
import { API_URL, authHeaders } from "./apiClient";

export type SecurityAlert = {
    kind: "ip" | "account";
    target: string;
    attempts: number;
    last_at: string;
};

export type SecurityEvent = {
    id: string;
    type: "LOGIN_FAILED" | "RATE_LIMITED";
    ip: string | null;
    email: string | null;
    path: string | null;
    created_at: string;
};

export type SecurityAlertsData = {
    threshold: number;
    windowMinutes: number;
    alerts: SecurityAlert[];
    recent: SecurityEvent[];
};

export async function fetchSecurityAlerts(signal?: AbortSignal): Promise<SecurityAlertsData> {
    const res = await fetch(`${API_URL}/admin/security-alerts`, { headers: authHeaders(), signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(body?.message || "Error al obtener las alertas de seguridad");
    }
    return body;
}
