import { Router } from 'express';
import pool from '../db.js';

import { authenticate, requireRoles } from '../services/auth.js';

import { isSafeImage, IMAGE_ERROR_MESSAGE } from '../services/imageValidation.js';

import { parseCatalogParams, buildCatalogQuery } from '../services/catalogQuery.js';

const router = Router();

// ── Productos (Desde DB) ──────────────────────────────────────────────────────
router.get("/products", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.nombre AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.created_at DESC`
    );
    const formatted = result.rows.map(p => ({
      ...p,
      notes: { salida: p.salida, corazon: p.corazon, fondo: p.fondo }
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener productos" });
  }
});

// Feedback del cliente: la portada muestra los más vendidos en vez de todo el catálogo.
// Orden: unidades vendidas en pedidos no cancelados, luego calificación y luego los más nuevos
// (así la portada se ve bien aunque todavía haya pocas ventas). Primero los que tienen stock.
// ?category=<id> filtra por categoría para las pestañas de la portada.
export const BEST_SELLERS_LIMIT = 8;

router.get("/products/best-sellers", async (req, res) => {
  const category = req.query.category === undefined || req.query.category === '' ? null : Number(req.query.category);
  if (category !== null && (!Number.isInteger(category) || category < 1)) {
    return res.status(400).json({ message: "La categoría no es válida." });
  }
  try {
    const result = await pool.query(
      `SELECT p.*, c.nombre AS category_name, COALESCE(v.vendidos, 0)::int AS sold
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN (
         SELECT oi.product_id, SUM(oi.quantity) AS vendidos
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status <> 'cancelado'
         GROUP BY oi.product_id
       ) v ON v.product_id = p.id
       WHERE ($1::int IS NULL OR p.category_id = $1)
       ORDER BY (p.stock > 0) DESC, COALESCE(v.vendidos, 0) DESC, p.rating_avg DESC NULLS LAST, p.created_at DESC
       LIMIT $2`,
      [category, BEST_SELLERS_LIMIT]
    );
    res.set("Cache-Control", "public, max-age=300").json(
      result.rows.map((p) => ({ ...p, notes: { salida: p.salida, corazon: p.corazon, fondo: p.fondo } }))
    );
  } catch (err) {
    console.error("Error al obtener los más vendidos:", err.message);
    res.status(500).json({ message: "Error al obtener productos" });
  }
});

// SFTWRKEY-424: catálogo con paginación y filtros (q, brand, category, minPrice, maxPrice, sort, page, pageSize).
// Se deja /products intacto porque otras pantallas (carrito, admin, buscador) esperan el arreglo completo.
router.get("/products/catalog", async (req, res) => {
  try {
    const params = parseCatalogParams(req.query);
    const { countSql, countValues, listSql, listValues } = buildCatalogQuery(params);
    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, countValues),
      pool.query(listSql, listValues),
    ]);
    const total = countResult.rows[0]?.total ?? 0;
    const items = listResult.rows.map((p) => ({
      ...p,
      notes: { salida: p.salida, corazon: p.corazon, fondo: p.fondo },
    }));
    res.json({
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener el catálogo" });
  }
});

// SFTWRKEY-424: marcas disponibles para el filtro del catálogo
router.get("/products/brands", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT brand FROM products
       WHERE stock > 0 AND brand IS NOT NULL AND brand <> ''
       ORDER BY brand ASC`
    );
    res.json({ brands: result.rows.map((r) => r.brand) });
  } catch (err) {
    res.status(500).json({ message: "Error al obtener marcas" });
  }
});

// buscar productos
router.get("/products/search", async (req, res) => {
  const { busqueda } = req.query;

  if (!busqueda || !busqueda.trim()) {
    return res.status(400).json({
      success: false,
      message: "Parámetro de búsqueda requerido."
    });
  }

  try {
    const result = await pool.query(
      `SELECT p.*, c.nombre AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.stock > 0
         AND (
           p.name ILIKE $1
           OR p.description ILIKE $1
           OR p.salida ILIKE $1
           OR p.corazon ILIKE $1
           OR p.fondo ILIKE $1
         )
       ORDER BY p.created_at DESC`,
      [`%${busqueda}%`]
    );

    const formatted = result.rows.map(p => ({
      ...p,
      notes: {
        salida: p.salida,
        corazon: p.corazon,
        fondo: p.fondo
      }
    }));

    res.json({
      success: true,
      products: formatted
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Error en búsqueda de productos."
    });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.nombre AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Producto no encontrado" });
    const p = result.rows[0];
    res.json({
      ...p,
      notes: { salida: p.salida, corazon: p.corazon, fondo: p.fondo }
    });
  } catch (err) {
    res.status(500).json({ message: "Error al obtener producto" });
  }
});

const PRODUCT_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const PRICE_REGEX = /^\d+(?:\.\d{1,2})?$/;
const STOCK_REGEX = /^\d+$/;

function validateProductPayload(body, { requireId }) {
  const { id, name, price, stock, notes, category_id } = body ?? {};

  if (requireId && (!id || typeof id !== "string" || !PRODUCT_ID_REGEX.test(id.trim()))) {
    return "El id es obligatorio y solo puede tener letras, números y guiones.";
  }
  if (!name || typeof name !== "string" || !name.trim() || name.length > 200) {
    return "El nombre es obligatorio y debe tener hasta 200 caracteres.";
  }
  if (price === undefined || price === null || !PRICE_REGEX.test(String(price))) {
    return "El precio debe ser un número no negativo con hasta dos decimales.";
  }
  if (stock !== undefined && stock !== null && !STOCK_REGEX.test(String(stock))) {
    return "El stock debe ser un número entero no negativo.";
  }
  if (category_id !== undefined && category_id !== null && !Number.isInteger(Number(category_id))) {
    return "category_id debe ser un número entero.";
  }
  if (notes !== undefined && notes !== null && (typeof notes !== "object" || Array.isArray(notes))) {
    return "notes debe ser un objeto con salida, corazon y fondo.";
  }
  if (!isSafeImage(body?.image)) {
    return IMAGE_ERROR_MESSAGE;
  }
  return null;
}

router.post("/products", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { id, name, price, image, description, stock, notes, category_id, brand, external_source, external_id, synced_at } = req.body;
  const validationError = validateProductPayload(req.body, { requireId: true });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    await pool.query(
      `INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo, category_id, brand, external_source, external_id, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, name, price, image, description, stock, notes?.salida, notes?.corazon, notes?.fondo, category_id || null, brand || null, external_source || null, external_id || null, synced_at || null]
    );
    res.status(201).json({ success: true, message: "Producto creado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al crear producto" });
  }
});

router.put("/products/:id", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { name, price, image, description, stock, notes, category_id, brand, external_source, external_id, synced_at } = req.body;
  // SFTWRKEY-379: el PUT usa la misma validación que el POST (antes aceptaba tipos y largos inválidos).
  const validationError = validateProductPayload(req.body, { requireId: false });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  try {
    const result = await pool.query(
      `UPDATE products
       SET name = $1, price = $2, image = $3, description = $4, stock = $5, salida = $6, corazon = $7, fondo = $8, category_id = $9, brand = $10, external_source = $11, external_id = $12, synced_at = $13
       WHERE id = $14`,
      [name, price, image, description, stock, notes?.salida, notes?.corazon, notes?.fondo, category_id || null, brand || null, external_source || null, external_id || null, synced_at || null, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Producto no encontrado" });
    }
    res.json({ success: true, message: "Producto actualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al actualizar producto" });
  }
});

router.delete("/products/:id", authenticate, requireRoles("ADMIN"), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Producto no encontrado" });
    }
    res.json({ success: true, message: "Producto eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al eliminar producto" });
  }
});

export default router;