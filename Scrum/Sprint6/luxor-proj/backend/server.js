import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from './db.js';
import bcrypt from 'bcryptjs';
import { CSV_TEMPLATE, validateCsv } from './csvImport.js';
import { listSyncLogs, logSyncError } from './services/perfumSyncLog.js';
import { searchExternalPerfumes, PerfumApiError } from './services/perfumApiClient.js';
import { getKnownBrands } from './services/perfumBrands.js';
import { mapExternalPerfumeToProduct } from './services/perfumMapper.js';
import { validateMappedPerfume } from './services/perfumValidation.js';
import { buildGatewayPayload, chargeCard, PaymentGatewayError } from './services/paymentGateway.js';
import {
  getGeneralMetrics,
  getMonthlySales,
  getSalesByCategory,
  getTopProducts,
  getInventoryByCategory,
} from './services/reportMetrics.js';
import { signToken, authenticate, authorizeSelfOrRoles, requireRoles } from './services/auth.js';
import { rateLimit } from './services/rateLimit.js';

const SALT_ROUNDS = 12;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: "2mb" }));

const ensureImportHistoryTable = () => pool.query(`
  CREATE TABLE IF NOT EXISTS product_imports (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    rejected_rows INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

const saveImportHistory = async ({ fileName, totalRows, importedRows, errors }) => {
  await ensureImportHistoryTable();
  const result = await pool.query(
    `INSERT INTO product_imports (file_name, total_rows, imported_rows, rejected_rows, errors)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, file_name, total_rows, imported_rows, rejected_rows, errors, created_at`,
    [fileName, totalRows, importedRows, new Set(errors.map((error) => error.row)).size, JSON.stringify(errors)]
  );
  return result.rows[0];
};

// ── Productos (Desde DB) ──────────────────────────────────────────────────────
app.get("/products", async (req, res) => {
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

// SFTWRKEY-275: Listar categorías disponibles (para poblar el filtro en el frontend)
app.get("/categories", async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre FROM categories ORDER BY nombre ASC');
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al obtener categorías" });
  }
});


// buscar productos
app.get("/products/search", async (req, res) => {
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
       WHERE p.name ILIKE $1
          OR p.description ILIKE $1
          OR p.salida ILIKE $1
          OR p.corazon ILIKE $1
          OR p.fondo ILIKE $1
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

app.get("/products/:id", async (req, res) => {
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

app.post("/products", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { id, name, price, image, description, stock, notes, category_id, brand, external_source, external_id, synced_at } = req.body;
  if (!id || !id.trim() || !name || !name.trim() || price === undefined || price === null || Number.isNaN(Number(price))) {
    return res.status(400).json({ success: false, message: "ID, nombre y precio son obligatorios." });
  }
  if (Number(price) < 0 || (stock !== undefined && stock !== null && Number(stock) < 0)) {
    return res.status(400).json({ success: false, message: "El precio y el stock no pueden ser negativos." });
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

app.put("/products/:id", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { name, price, image, description, stock, notes, category_id, brand, external_source, external_id, synced_at } = req.body;
  if (!name || !name.trim() || price === undefined || price === null || Number.isNaN(Number(price))) {
    return res.status(400).json({ success: false, message: "Nombre y precio son obligatorios." });
  }
  if (Number(price) < 0 || (stock !== undefined && stock !== null && Number(stock) < 0)) {
    return res.status(400).json({ success: false, message: "El precio y el stock no pueden ser negativos." });
  }
  try {
    await pool.query(
      `UPDATE products
       SET name = $1, price = $2, image = $3, description = $4, stock = $5, salida = $6, corazon = $7, fondo = $8, category_id = $9, brand = $10, external_source = $11, external_id = $12, synced_at = $13
       WHERE id = $14`,
      [name, price, image, description, stock, notes?.salida, notes?.corazon, notes?.fondo, category_id || null, brand || null, external_source || null, external_id || null, synced_at || null, req.params.id]
    );
    res.json({ success: true, message: "Producto actualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al actualizar producto" });
  }
});

app.delete("/products/:id", authenticate, requireRoles("ADMIN"), async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: "Producto eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al eliminar producto" });
  }
});

// fragmento para la integracion PerfumAPI: busqueda para el admin
// compone cliente + marcas + mapper + validacion + log de errores
// sin restriccion por catalogo propio: el admin puede buscar cualquier perfume.
app.get("/external-perfumes/search", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { q, brand } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ success: false, message: "Parámetro de búsqueda 'q' requerido." });
  }

  try {
    const raw = await searchExternalPerfumes(q, 30);
    const filtered = brand && brand.trim()
      ? raw.filter((p) => (p.brand || '').toLowerCase() === brand.trim().toLowerCase())
      : raw;

    const results = [];
    for (const item of filtered) {
      const mapped = mapExternalPerfumeToProduct(item);
      const { ok, candidate, warnings } = validateMappedPerfume(mapped);
      if (!ok) {
        await logSyncError({ query: q, externalId: item.id, errorMessage: warnings.join('; ') });
        continue;
      }
      results.push({ ...candidate, warnings });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    const message = err instanceof PerfumApiError ? err.message : 'No se pudo consultar PerfumAPI.';
    await logSyncError({ query: q, errorMessage: message });
    res.status(502).json({ success: false, message });
  }
});

// marcas conocidas por PerfumAPI, para un filtro opcional en el buscador del admin
app.get("/external-perfumes/brands", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const brands = await getKnownBrands();
    res.json({ success: true, brands });
  } catch (err) {
    console.error(err);
    const message = err instanceof PerfumApiError ? err.message : 'No se pudo consultar las marcas de PerfumAPI.';
    await logSyncError({ errorMessage: message });
    res.status(502).json({ success: false, message });
  }
});

// integracion PerfumAPI: historial de errores de sincronizacion
app.get("/admin/perfum-sync-logs", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const logs = await listSyncLogs();
    res.json({ success: true, logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "No se pudo consultar el historial de errores de PerfumAPI." });
  }
});

// SFTWRKEY-277..282: formato, lectura, validación, importación e historial CSV.
app.get("/imports/products/template", authenticate, requireRoles("ADMIN"), (_req, res) => {
  res.type("text/csv").attachment("plantilla-perfumes.csv").send(CSV_TEMPLATE);
});

app.get("/imports/products", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    await ensureImportHistoryTable();
    const result = await pool.query(
      `SELECT id, file_name, total_rows, imported_rows, rejected_rows, errors, created_at
       FROM product_imports ORDER BY created_at DESC, id DESC LIMIT 50`
    );
    res.json({ success: true, imports: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "No se pudo consultar el historial de importaciones." });
  }
});

app.post("/imports/products", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { fileName = "importacion.csv", csv } = req.body ?? {};
  if (typeof fileName !== "string" || !fileName.toLowerCase().endsWith(".csv")) {
    return res.status(400).json({ success: false, message: "Debe seleccionar un archivo con extensión .csv." });
  }
  try {
    const parsed = validateCsv(csv);
    const errors = [...parsed.errors];
    const ids = parsed.products.map((product) => product.id);
    const existing = await pool.query("SELECT id FROM products WHERE id = ANY($1::varchar[])", [ids]);
    const existingIds = new Set(existing.rows.map((product) => product.id.toLowerCase()));
    parsed.products.forEach((product) => {
      if (existingIds.has(product.id.toLowerCase())) {
        errors.push({ row: product.row, field: "id", message: "Ya existe un perfume con este identificador." });
      }
    });
    const rejectedRows = new Set(errors.map((error) => error.row));
    const validProducts = parsed.products.filter((product) => !rejectedRows.has(product.row));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const product of validProducts) {
        await client.query(
          `INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [product.id, product.name, product.price, product.image || null, product.description || null,
            product.stock, product.salida || null, product.corazon || null, product.fondo || null]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    const history = await saveImportHistory({ fileName: fileName.slice(0, 255), totalRows: parsed.totalRows, importedRows: validProducts.length, errors });
    res.status(201).json({ success: true, message: "Importación procesada.", summary: history });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "No se pudo procesar el archivo CSV.";
    res.status(400).json({ success: false, message });
  }
});

app.get("/", (req, res) => res.send("Backend Luxor funcionando"));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post("/login", rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: "Requerido" });
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password AS password_hash, r.nombre AS role
       FROM users u JOIN rol r ON u.role = r.id_rol
       WHERE u.email = $1`, [email]
    );
    const dummyHash = '$2a$12$invalidhashforcomparisononlyx';
    const storedHash = result.rows.length > 0 ? result.rows[0].password_hash : dummyHash;
    const match = await bcrypt.compare(password, storedHash);
    if (result.rows.length === 0 || !match) return res.status(401).json({ success: false, message: "Error" });
    const user = result.rows[0];
    const publicUser = { id: user.id, name: user.name, role: user.role };
    const token = signToken(publicUser);
    return res.json({ success: true, token, user: publicUser });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
});

// SFTWRKEY-220 + SFTWRKEY-223: Register con validación de campos y email duplicado
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  // Validar que todos los campos estén presentes
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Todos los campos son requeridos." });
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "El formato del correo no es válido." });
  }

  // Validar longitud mínima de contraseña
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 6 caracteres." });
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 3) RETURNING id, name, email',
      [name, email, hash]
    );
    return res.status(201).json({ success: true, user: { ...result.rows[0], role: 'CLIENTE' } });
  } catch (err) {
    // SFTWRKEY-223: Detectar email duplicado (código 23505 = unique_violation en PostgreSQL)
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: "El correo ya está registrado." });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
});

// ── Usuario ───────────────────────────────────────────────────────────────────
app.get("/user/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, r.nombre AS role
       FROM users u JOIN rol r ON u.role = r.id_rol
       WHERE u.id = $1`,
      [req.params.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al obtener usuario" });
  }
});

// SFTWRKEY-323/324/325: Historial real de pedidos
app.get("/user/:userId/orders", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT id, total, status, created_at
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.params.userId]
    );

    const orders = [];
    for (const order of ordersResult.rows) {
      const itemsResult = await pool.query(
        `SELECT oi.product_id, oi.quantity, oi.unit_price, p.name, p.image
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [order.id]
      );
      orders.push({ ...order, items: itemsResult.rows });
    }

    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener el historial de pedidos" });
  }
});

// SFTWRKEY-321: Editar información personal
app.put("/user/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: "Nombre y correo son requeridos." });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "El formato del correo no es válido." });
  }
  try {
    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2 WHERE id = $3
       RETURNING id, name, email`,
      [name, email, req.params.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: "Ese correo ya está en uso por otra cuenta." });
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Error al actualizar la información." });
  }
});

// SFTWRKEY-322: Cambiar contraseña
app.put("/user/:userId/password", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), rateLimit({ windowMs: 60_000, max: 10 }), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Debes ingresar la contraseña actual y la nueva." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "La nueva contraseña debe tener al menos 6 caracteres." });
  }
  try {
    const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [req.params.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    const match = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!match) {
      return res.status(401).json({ success: false, message: "La contraseña actual es incorrecta." });
    }
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, req.params.userId]);
    res.json({ success: true, message: "Contraseña actualizada correctamente." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al cambiar la contraseña." });
  }
});

// SFTWRKEY-215: Búsqueda de usuarios con ILIKE (case-insensitive)
app.get("/users/search", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, message: "Parámetro de búsqueda requerido." });
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, r.nombre AS role
       FROM users u JOIN rol r ON u.role = r.id_rol
       WHERE u.name ILIKE $1 OR u.email ILIKE $1
       ORDER BY u.name ASC`,
      [`%${q}%`]
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error en búsqueda." });
  }
});

// ── Carrito ───────────────────────────────────────────────────────────────────
app.get("/cart/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  try {
    const cartResult = await pool.query('SELECT id FROM carts WHERE user_id = $1', [req.params.userId]);
    if (cartResult.rows.length === 0) return res.json([]);
    const items = await pool.query('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [cartResult.rows[0].id]);
    res.json(items.rows);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

app.post("/cart/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  const userId = req.params.userId;
  const items = req.body;
  try {
    let cartResult = await pool.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0)
      cartResult = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
    const cartId = cartResult.rows[0].id;
    await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    for (const item of items) {
      await pool.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)', [cartId, item.product_id, item.quantity]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// ── Reportes ──────────────────────────────────────────────────────────────────
app.get("/report", authenticate, requireRoles("ADMIN"), async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) as total FROM users');
    const items = await pool.query('SELECT SUM(quantity) as total FROM cart_items');
    const top = await pool.query('SELECT product_id, SUM(quantity) as total_quantity FROM cart_items GROUP BY product_id ORDER BY total_quantity DESC LIMIT 5');
    res.json({ success: true, data: { totalUsers: parseInt(users.rows[0].total), totalItemsInCarts: parseInt(items.rows[0].total) || 0, topProducts: top.rows } });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});


// métricas generales del
app.get("/report/metrics", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const metrics = await getGeneralMetrics();
    res.json({ success: true, metrics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener las métricas generales." });
  }
});

//ventas por mes ultimos 12
app.get("/report/sales-monthly", authenticate, requireRoles("ADMIN"), async (req, res) => {
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
app.get("/report/sales-by-category", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const sales = await getSalesByCategory();
    res.json({ success: true, sales });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener las ventas por categoría." });
  }
});

// productos más vendidos
app.get("/report/top-products", authenticate, requireRoles("ADMIN"), async (req, res) => {
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
app.get("/report/inventory", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const inventory = await getInventoryByCategory();
    res.json({ success: true, inventory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener el inventario por categoría." });
  }
});

// ── Checkout / Pagos ─────────────────────────────────────────────────────────
const ensurePaymentsTable = () => pool.query(`
  CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'GTQ',
    status VARCHAR(20) NOT NULL,
    gateway_reference VARCHAR(100),
    auth_code VARCHAR(20),
    card_brand VARCHAR(20),
    card_last4 VARCHAR(4),
    decline_code VARCHAR(50),
    decline_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

const savePaymentRecord = async ({ orderId, userId, amount, status, gatewayResult }) => {
  await ensurePaymentsTable();
  const result = await pool.query(
    `INSERT INTO payments
       (order_id, user_id, amount, status, gateway_reference, auth_code, card_brand, card_last4, decline_code, decline_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, order_id, status, card_brand, card_last4, created_at`,
    [
      orderId,
      userId,
      amount,
      status,
      gatewayResult.transactionId,
      gatewayResult.authCode,
      gatewayResult.brand,
      gatewayResult.last4,
      gatewayResult.declineCode,
      gatewayResult.declineMessage,
    ]
  );
  return result.rows[0];
};

const CARD_FIELDS = ["cardholderName", "cardNumber", "expiryMonth", "expiryYear", "cvv", "billingAddress", "city", "postalCode", "country"];

function validateCardPayload(body) {
  for (const field of CARD_FIELDS) {
    if (!body?.[field] || !String(body[field]).trim()) {
      return `El campo '${field}' es requerido para procesar el pago.`;
    }
  }
  const digits = String(body.cardNumber).replace(/\D/g, "");
  if (digits.length !== 16) return "El número de tarjeta debe tener 16 dígitos.";
  if (!/^\d{3}$/.test(body.cvv)) return "El CVV debe tener exactamente 3 dígitos.";
  return null;
}

// SFTWRKEY-295: Crear endpoint para pagos
// SFTWRKEY-296: Enviar información del carrito (a la pasarela)
// SFTWRKEY-297: Procesar respuesta de la pasarela
// SFTWRKEY-298: Mostrar confirmación de compra (datos que consume el frontend)
// SFTWRKEY-299: Registrar pago en base de datos
// SFTWRKEY-300: Manejo de pagos rechazados
app.post("/checkout/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  const { userId } = req.params;
  const cardPayload = req.body ?? {};

  const validationError = validateCardPayload(cardPayload);
  if (validationError) {
    return res.status(400).json({ success: false, code: "INVALID_PAYMENT_DATA", message: validationError });
  }

  const client = await pool.connect();

  try {
    await ensurePaymentsTable();
    const cartResult = await client.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) {
      return res.status(400).json({ success: false, code: "EMPTY_CART", message: "Tu carrito está vacío." });
    }
    const cartId = cartResult.rows[0].id;

    const itemsResult = await client.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    if (itemsResult.rows.length === 0) {
      return res.status(400).json({ success: false, code: "EMPTY_CART", message: "Tu carrito está vacío." });
    }

    const sinStock = itemsResult.rows.filter(item => item.quantity > item.stock);
    if (sinStock.length > 0) {
      return res.status(409).json({
        success: false,
        code: "INSUFFICIENT_STOCK",
        message: "Algunos productos ya no tienen stock suficiente.",
        items: sinStock.map(i => ({ product_id: i.product_id, name: i.name, disponible: i.stock, solicitado: i.quantity }))
      });
    }

    const total = itemsResult.rows.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    // Recalculado a partir de p.price en la consulta anterior: el monto nunca se confía del cliente.

    // SFTWRKEY-296: se arma el payload con el detalle del carrito y se envía a la pasarela
    const gatewayPayload = buildGatewayPayload({
      orderReference: `user-${userId}-${Date.now()}`,
      amount: total,
      cartItems: itemsResult.rows,
      card: cardPayload,
      billing: cardPayload,
    });

    // SFTWRKEY-297: se procesa la respuesta de la pasarela (aprobado o rechazado)
    const gatewayResult = await chargeCard(gatewayPayload);

    if (!gatewayResult.approved) {
      // SFTWRKEY-300: manejo de pagos rechazados — se registra el intento fallido
      // (sin crear orden ni tocar el stock) y se informa el motivo al frontend.
      const payment = await savePaymentRecord({
        orderId: null,
        userId,
        amount: total,
        status: "rechazado",
        gatewayResult,
      });
      return res.status(402).json({
        success: false,
        code: "CARD_DECLINED",
        message: gatewayResult.declineMessage,
        declineCode: gatewayResult.declineCode,
        payment: { id: payment.id, status: payment.status },
      });
    }

    await client.query('BEGIN');

    // Se vuelve a verificar y bloquear el stock dentro de la transacción para evitar
    // que dos checkouts concurrentes sobrevendan el mismo producto.
    for (const item of itemsResult.rows) {
      const stockResult = await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id`,
        [item.quantity, item.product_id]
      );
      if (stockResult.rows.length === 0) {
        throw Object.assign(new Error("Stock insuficiente al confirmar el pago."), { code: "INSUFFICIENT_STOCK" });
      }
    }

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, total, status) VALUES ($1, $2, 'completed') RETURNING id, created_at`,
      [userId, total]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of itemsResult.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, item.price]
      );
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    // SFTWRKEY-299: Registrar pago en base de datos, dentro de la misma transacción
    // que la orden — si esto falla, el ROLLBACK revierte también la orden y el stock.
    const paymentInsert = await client.query(
      `INSERT INTO payments
         (order_id, user_id, amount, status, gateway_reference, auth_code, card_brand, card_last4, decline_code, decline_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, order_id, status, card_brand, card_last4, created_at`,
      [
        orderId, userId, total, "aprobado",
        gatewayResult.transactionId, gatewayResult.authCode, gatewayResult.brand,
        gatewayResult.last4, gatewayResult.declineCode, gatewayResult.declineMessage,
      ]
    );
    const payment = paymentInsert.rows[0];

    await client.query('COMMIT');

    // SFTWRKEY-298: datos que la página de confirmación necesita mostrar
    return res.status(201).json({
      success: true,
      message: "Compra realizada con éxito.",
      order: { id: orderId, total, created_at: orderResult.rows[0].created_at },
      payment: {
        id: payment.id,
        status: payment.status,
        brand: gatewayResult.brand,
        last4: gatewayResult.last4,
        authCode: gatewayResult.authCode,
      },
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Error en checkout:", err);
    if (err instanceof PaymentGatewayError) {
      return res.status(502).json({ success: false, code: err.code, message: "No se pudo contactar a la pasarela de pago. Intenta de nuevo." });
    }
    if (err.code === "INSUFFICIENT_STOCK") {
      return res.status(409).json({ success: false, code: "INSUFFICIENT_STOCK", message: "Algunos productos ya no tienen stock suficiente." });
    }
    return res.status(500).json({
      success: false,
      code: "PAYMENT_ERROR",
      message: "No se pudo procesar el pago. Intenta de nuevo."
    });
  } finally {
    client.release();
  }
});

// Historial de preguntas y respuestas del chatbot
// SFTWRKEY-293: Registrar consultas del chatbot
const ensureChatbotQueriesTable = () => pool.query(`
  CREATE TABLE IF NOT EXISTS chatbot_queries (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    response TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

app.post("/chatbot/queries", async (req, res) => {
    const { query, response } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "La consulta es requerida."
      });
    }

    try {
      await ensureChatbotQueriesTable();
      const result = await pool.query(
        `INSERT INTO chatbot_queries (query, response)
        VALUES ($1, $2)
        RETURNING id, query, response, created_at`,
        [query, response || null]
      );

      return res.status(201).json({
        success: true,
        query: result.rows[0]
      });

    } catch (err) {
      console.error("Error registrando consulta del chatbot:", err);

      return res.status(500).json({
        success: false,
        message: "No se pudo registrar la consulta."
      });
    }
});


app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));