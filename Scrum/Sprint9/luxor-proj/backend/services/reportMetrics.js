import pool from '../db.js';
const toNumber = (value) => Number(value ?? 0);

// los meses sin venta salen con 0 para las graficas
export function fillMonthlySeries(rows, months, reference = new Date()) {
    const byMonth = new Map(rows.map((row) => [row.month, row]));
    const series = [];
    for (let offset = months - 1; offset >= 0; offset -= 1) {
        const date = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - offset, 1));
        const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        const found = byMonth.get(month);
        series.push({
        month,
            orders: toNumber(found?.orders),
            revenue: toNumber(found?.revenue),
        });
        byMonth.delete(month);
    }
    for (const row of byMonth.values()) {
        series.push({ month: row.month, orders: toNumber(row.orders), revenue: toNumber(row.revenue) });
    }
    return series.sort((a, b) => a.month.localeCompare(b.month));
}


// matriz genearal de todas las ordenes completadas
export async function getGeneralMetrics(db = pool) {
    const result = await db.query(
        `SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM products) AS total_products,
        (SELECT COUNT(*) FROM orders WHERE status = 'completed') AS total_orders,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'completed') AS total_revenue,
        (SELECT COALESCE(SUM(oi.quantity), 0)
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status = 'completed') AS total_units_sold,
        (SELECT COALESCE(SUM(stock), 0) FROM products) AS total_stock`
    );
    const row = result.rows[0] ?? {};
    return {
        totalUsers: toNumber(row.total_users),
        totalProducts: toNumber(row.total_products),
        totalOrders: toNumber(row.total_orders),
        totalRevenue: toNumber(row.total_revenue),
        totalUnitsSold: toNumber(row.total_units_sold),
        totalStock: toNumber(row.total_stock),
    };
}

// ventas mensuales de los ultimos 12 meses
export async function getMonthlySales(months = 12, db = pool) {
    const result = await db.query(
        `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
                COUNT(*) AS orders,
                COALESCE(SUM(total), 0) AS revenue
        FROM orders
        WHERE status = 'completed'
        AND created_at >= date_trunc('month', NOW()) - make_interval(months => $1 - 1)
        GROUP BY 1
        ORDER BY 1`,
        [months]
    );
    return fillMonthlySeries(result.rows, months);
}

// ventas por categoria de producto
export async function getSalesByCategory(db = pool) {
    const result = await db.query(
        `SELECT COALESCE(c.nombre, 'Sin categoría') AS category,
                SUM(oi.quantity) AS units,
                SUM(oi.quantity * oi.unit_price) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        GROUP BY 1
        ORDER BY revenue DESC`
    );
    return result.rows.map((row) => ({
        category: row.category,
        units: toNumber(row.units),
        revenue: toNumber(row.revenue),
    }));
}

// lo mas vendido
export async function getTopProducts(limit = 5, db = pool) {
    const result = await db.query(
        `SELECT p.id AS product_id,
                p.name,
                COALESCE(c.nombre, 'Sin categoría') AS category,
                SUM(oi.quantity) AS units,
                SUM(oi.quantity * oi.unit_price) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        GROUP BY p.id, p.name, c.nombre
        ORDER BY units DESC
        LIMIT $1`,
        [limit]
    );
    return result.rows.map((row) => ({
        product_id: row.product_id,
        name: row.name,
        category: row.category,
        units: toNumber(row.units),
        revenue: toNumber(row.revenue),
    }));
}

// inventario por categoria
export async function getInventoryByCategory(db = pool) {
    const result = await db.query(
        `SELECT COALESCE(c.nombre, 'Sin categoría') AS category,
                COUNT(p.id) AS products,
                COALESCE(SUM(p.stock), 0) AS stock
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        GROUP BY 1
        ORDER BY stock DESC`
    );
    return result.rows.map((row) => ({
        category: row.category,
        products: toNumber(row.products),
        stock: toNumber(row.stock),
    }));
}
