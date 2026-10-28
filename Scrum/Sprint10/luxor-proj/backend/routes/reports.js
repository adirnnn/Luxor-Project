import { Router } from 'express';
import pool from '../db.js';
import { authenticate, requireRoles } from '../services/auth.js';
import { getGeneralMetrics, getMonthlySales, getSalesByCategory, getTopProducts, getInventoryByCategory } from '../services/reportMetrics.js';

const router = Router();

// ── Reportes ──────────────────────────────────────────────────────────────────
router.get("/report", authenticate, requireRoles("ADMIN"), async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) as total FROM users');
    const items = await pool.query('SELECT SUM(quantity) as total FROM cart_items');
    const top = await pool.query(`SELECT oi.product_id, SUM(oi.quantity) as total_quantity
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelado'
        GROUP BY oi.product_id
        ORDER BY total_quantity DESC
        LIMIT 5`);
    res.json({ success: true, data: { totalUsers: parseInt(users.rows[0].total), totalItemsInCarts: parseInt(items.rows[0].total) || 0, topProducts: top.rows } });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// métricas generales del
router.get("/report/metrics", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const metrics = await getGeneralMetrics();
    res.json({ success: true, metrics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener las métricas generales." });
  }
});

//ventas por mes ultimos 12
router.get("/report/sales-monthly", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const months = Number(req.query.months ?? 12);
  if (!Number.isInteger(months) || months < 1 || months > 36) {
    return res.status(400).json({ success: false, message: "El parámetro 'months' debe ser un entero entre 1 y 36." });
  }
  try {
    const sales = await getMonthlySales(months);
    res.json({ success: true, sales });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener las ventas mensuales." });
  }
});

// ventas por categoría (no existía ningún endpoint con este dato)
router.get("/report/sales-by-category", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const sales = await getSalesByCategory();
    res.json({ success: true, sales });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener las ventas por categoría." });
  }
});

// productos más vendidos
router.get("/report/top-products", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const limit = Number(req.query.limit ?? 5);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ success: false, message: "El parámetro 'limit' debe ser un entero entre 1 y 50." });
  }
  try {
    const products = await getTopProducts(limit);
    res.json({ success: true, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener los productos más vendidos." });
  }
});

// inventario por categoría
router.get("/report/inventory", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const inventory = await getInventoryByCategory();
    res.json({ success: true, inventory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener el inventario por categoría." });
  }
});

export default router;