import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from './db.js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// ── Productos (Desde DB) ──────────────────────────────────────────────────────
app.get("/products", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    const formatted = result.rows.map(p => ({
      ...p,
      notes: { salida: p.salida, corazon: p.corazon, fondo: p.fondo }
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener productos" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
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
  const { id, name, price, image, description, stock, notes } = req.body;
  try {
    await pool.query(
      `INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, name, price, image, description, stock, notes?.salida, notes?.corazon, notes?.fondo]
    );
    res.status(201).json({ success: true, message: "Producto creado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al crear producto" });
  }
});

app.put("/products/:id", async (req, res) => {
  const { name, price, image, description, stock, notes } = req.body;
  try {
    await pool.query(
      `UPDATE products 
       SET name = $1, price = $2, image = $3, description = $4, stock = $5, salida = $6, corazon = $7, fondo = $8
       WHERE id = $9`,
      [name, price, image, description, stock, notes?.salida, notes?.corazon, notes?.fondo, req.params.id]
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

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));