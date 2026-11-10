// Consola del admin: resumen, inventario con filtros, stock rápido, clientes y borrar cuentas
// (backend/routes/adminConsole.js). La sesión va en la cookie, como el resto de la API.
import { API_URL } from "./apiClient";

async function pedir<T>(path: string, mensaje: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || mensaje);
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type AdminSummary = {
  lowStock: number;
  productos: { total: number; agotados: number; bajo: number };
  pedidos: { por_preparar: number; en_preparacion: number; enviados: number };
  hoy: { pedidos: number; ventas: number };
  clientes: { total: number; nuevos: number };
};

export const fetchAdminSummary = () => pedir<AdminSummary>("/admin/summary", "No se pudo cargar el resumen.");

export type StockFilter = "" | "agotado" | "bajo" | "disponible";
export type InventorySort = "nombre" | "precio_asc" | "precio_desc" | "stock_asc" | "stock_desc" | "marca";

export type InventoryFilters = {
  q?: string;
  stock?: StockFilter;
  category?: string;
  brand?: string;
  sort?: InventorySort;
  page?: number;
  pageSize?: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  stock: number;
  image: string | null;
  category: string | null;
};

export type InventoryPage = {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: { todos: number; agotado: number; bajo: number; disponible: number };
  lowStock: number;
};

const query = (filters: Record<string, unknown>) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== "" && v !== null) params.set(k, String(v));
  return params.toString();
};

export const fetchInventory = (filters: InventoryFilters) =>
  pedir<InventoryPage>(`/admin/products?${query(filters)}`, "No se pudo cargar el inventario.");

export const updateStock = (id: string, stock: number) =>
  pedir<{ stock: number; antes: number }>(
    `/admin/products/${encodeURIComponent(id)}/stock`,
    "No se pudo cambiar el stock.",
    json("PATCH", { stock })
  );

export type AdminClient = {
  id: number;
  name: string;
  email: string;
  role: "CLIENTE" | "MAYORISTA" | "ADMIN";
  created_at: string;
  email_verified: boolean;
  pedidos: number;
  gastado: number;
  ultimo_pedido: string | null;
};

export const fetchClients = (filters: { q?: string; role?: string; page?: number; pageSize?: number }) =>
  pedir<{ users: AdminClient[]; total: number; page: number; pageSize: number }>(
    `/admin/users?${query(filters)}`,
    "No se pudo cargar la lista de clientes."
  );

export const deleteClient = (id: number) =>
  pedir<{ message: string }>(`/admin/users/${id}`, "No se pudo borrar la cuenta.", { method: "DELETE" });

// el cliente borra su propia cuenta: contraseña, o "ELIMINAR" si la creó con Google
export const deleteMyAccount = (confirmacion: { password?: string; confirm?: string }) =>
  pedir<{ message: string }>("/me", "No se pudo borrar la cuenta.", json("DELETE", confirmacion));
