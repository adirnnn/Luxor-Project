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

app.post("/products", async (req, res) => {
  const { id, name, price, image, description, stock, notes, category_id, brand, external_source, external_id, synced_at } = req.body;
  if (!id || !id.trim() || !name || !name.trim() || price === undefined || price === null || Number.isNaN(Number(price))) {
    return res.status(400).json({ success: false, message: "ID, nombre y precio son obligatorios." });
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

app.put("/products/:id", async (req, res) => {
  const { name, price, image, description, stock, notes, category_id, brand, external_source, external_id, synced_at } = req.body;
  if (!name || !name.trim() || price === undefined || price === null || Number.isNaN(Number(price))) {
    return res.status(400).json({ success: false, message: "Nombre y precio son obligatorios." });
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

app.delete("/products/:id", async (req, res) => {
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
app.get("/external-perfumes/search", async (req, res) => {
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
app.get("/external-perfumes/brands", async (_req, res) => {
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
app.get("/admin/perfum-sync-logs", async (_req, res) => {
  try {
    const logs = await listSyncLogs();
    res.json({ success: true, logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "No se pudo consultar el historial de errores de PerfumAPI." });
  }
});

// SFTWRKEY-277..282: formato, lectura, validación, importación e historial CSV.
app.get("/imports/products/template", (_req, res) => {
  res.type("text/csv").attachment("plantilla-perfumes.csv").send(CSV_TEMPLATE);
});

app.get("/imports/products", async (_req, res) => {
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

app.post("/imports/products", async (req, res) => {
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
app.post("/login", async (req, res) => {
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
    return res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
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
app.get("/user/:userId", async (req, res) => {
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

app.get("/user/:userId/purchases", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.image
       FROM carts c
       JOIN cart_items ci ON c.id = ci.cart_id
       JOIN products p ON ci.product_id = p.id
       WHERE c.user_id = $1
       ORDER BY ci.id DESC`,
      [req.params.userId]
    );
    res.json({ success: true, purchases: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al obtener historial" });
  }
});

// SFTWRKEY-215: Búsqueda de usuarios con ILIKE (case-insensitive)
app.get("/users/search", async (req, res) => {
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
app.get("/cart/:userId", async (req, res) => {
  try {
    const cartResult = await pool.query('SELECT id FROM carts WHERE user_id = $1', [req.params.userId]);
    if (cartResult.rows.length === 0) return res.json([]);
    const items = await pool.query('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [cartResult.rows[0].id]);
    res.json(items.rows);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

app.post("/cart/:userId", async (req, res) => {
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
app.get("/report", async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) as total FROM users');
    const items = await pool.query('SELECT SUM(quantity) as total FROM cart_items');
    const top = await pool.query('SELECT product_id, SUM(quantity) as total_quantity FROM cart_items GROUP BY product_id ORDER BY total_quantity DESC LIMIT 5');
    res.json({ success: true, data: { totalUsers: parseInt(users.rows[0].total), totalItemsInCarts: parseInt(items.rows[0].total) || 0, topProducts: top.rows } });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ── Checkout / Pagos ─────────────────────────────────────────────────────────
app.post("/checkout/:userId", async (req, res) => {
  const { userId } = req.params;
  const client = await pool.connect();

  try {
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

    await client.query('BEGIN');

    const total = itemsResult.rows.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

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
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: "Compra realizada con éxito.",
      order: { id: orderId, total, created_at: orderResult.rows[0].created_at }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error en checkout:", err);
    return res.status(500).json({
      success: false,
      code: "PAYMENT_ERROR",
      message: "No se pudo procesar el pago. Intenta de nuevo."
    });
  } finally {
    client.release();
  }
});


app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
