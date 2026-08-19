// uso de los endpoints de metricas
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type GeneralMetrics = {
    totalUsers: number;
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    totalUnitsSold: number;
    totalStock: number;
};

export type MonthlySale = {
    month: string;
    orders: number;
    revenue: number;
};

export type CategorySale = {
    category: string;
    units: number;
    revenue: number;
};

export type TopProduct = {
    product_id: string;
    name: string;
    category: string;
    units: number;
    revenue: number;
};

export type CategoryInventory = {
    category: string;
    products: number;
    stock: number;
};

async function getJson(path: string, errorMessage: string) {
    const res = await fetch(`${API_URL}${path}`);
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || errorMessage);
    }
    return res.json();
}

export async function fetchGeneralMetrics(): Promise<GeneralMetrics> {
    const data = await getJson('/report/metrics', 'Error al obtener las métricas generales');
    return data.metrics;
}

export async function fetchMonthlySales(months = 12): Promise<MonthlySale[]> {
    const data = await getJson(`/report/sales-monthly?months=${months}`, 'Error al obtener las ventas mensuales');
    return data.sales;
}

export async function fetchSalesByCategory(): Promise<CategorySale[]> {
    const data = await getJson('/report/sales-by-category', 'Error al obtener las ventas por categoría');
    return data.sales;
}

export async function fetchTopProducts(limit = 5): Promise<TopProduct[]> {
    const data = await getJson(`/report/top-products?limit=${limit}`, 'Error al obtener los productos más vendidos');
    return data.products;
}

export async function fetchInventoryByCategory(): Promise<CategoryInventory[]> {
    const data = await getJson('/report/inventory', 'Error al obtener el inventario por categoría');
    return data.inventory;
}
