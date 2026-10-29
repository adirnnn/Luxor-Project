// Feedback del cliente: el admin define el porcentaje de los mayoristas y qué clientes lo son.
import { API_URL } from "./apiClient";

export type WholesaleCustomer = { id: number; name: string; email: string; role: "CLIENTE" | "MAYORISTA" };

async function send<T>(path: string, init: RequestInit = {}, fallback = "No se pudo completar la operación."): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || fallback);
    return data as T;
}

export const fetchWholesale = () =>
    send<{ percent: number; customers: WholesaleCustomer[] }>("/admin/wholesale", {}, "No se pudieron cargar los mayoristas.");

export const saveWholesalePercent = (percent: number) =>
    send<{ percent: number }>("/admin/wholesale", { method: "PUT", body: JSON.stringify({ percent }) }, "No se pudo guardar el porcentaje.");

export const searchCustomers = (q: string) =>
    send<{ customers: WholesaleCustomer[] }>(`/admin/customers?q=${encodeURIComponent(q)}`, {}, "No se pudo buscar.");

export const setCustomerRole = (id: number, role: WholesaleCustomer["role"]) =>
    send<{ customer: WholesaleCustomer }>(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }, "No se pudo cambiar el rol.");
