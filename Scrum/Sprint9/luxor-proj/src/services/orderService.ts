// SFTWRKEY-419: pedidos del panel de admin
import { API_URL, authHeaders } from "./apiClient";

export type AdminOrder = {
    id: number;
    created_at: string;
    total: number;
    status: string;
    is_guest: boolean;
    customer_name: string;
    customer_email: string | null;
    items_count: number;
};

export type AdminOrderDetail = Omit<AdminOrder, "items_count"> & {
    guest_address: { billingAddress: string; city: string; postalCode: string; country: string } | null;
    items: {
        product_id: string;
        name: string;
        image: string | null;
        quantity: number;
        unit_price: number;
        subtotal: number;
    }[];
    history: {
        from_status: string | null;
        to_status: string;
        changed_at: string;
        changed_by_name: string | null;
    }[];
    allowedNextStatuses: string[];
};

export type OrderFilters = {
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
};

async function getJson(path: string, errorMessage: string, init?: RequestInit) {
    const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...authHeaders(), ...init?.headers } });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(body?.message || errorMessage);
    }
    return body;
}

export async function fetchAdminOrders(filters: OrderFilters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const data = await getJson(`/admin/orders?${params}`, "Error al obtener los pedidos");
    return data as { orders: AdminOrder[]; total: number; page: number; limit: number };
}

export async function fetchAdminOrder(id: number): Promise<AdminOrderDetail> {
    const data = await getJson(`/admin/orders/${id}`, "Error al obtener el pedido");
    return data.order;
}

export async function updateOrderStatus(id: number, status: string) {
    const data = await getJson(`/admin/orders/${id}/status`, "No se pudo actualizar el estado del pedido", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    return data.order;
}
