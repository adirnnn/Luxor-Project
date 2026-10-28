import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { authenticate, authorizeSelfOrRoles, requireRoles } from '../services/auth.js';
import { rateLimit } from '../services/rateLimit.js';
import { onRateLimitBlock } from '../services/securityAudit.js';
import { validatePassword } from '../services/passwordPolicy.js';
import { deliveryView } from '../services/shipping.js';

const router = Router();
const SALT_ROUNDS = 12;

// ── Usuario ───────────────────────────────────────────────────────────────────
router.get("/user/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
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
router.get("/user/:userId/orders", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT id, total, status, created_at, shipping_cost, delivery_method, delivery_address
       FROM orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.params.userId]
    );

    // SFTWRKEY-420: productos e historial de todos los pedidos en dos consultas
    // (antes era una consulta por cada pedido)
    const ids = ordersResult.rows.map((order) => order.id);
    let items = [];
    let history = [];
    if (ids.length > 0) {
      const itemsResult = await pool.query(
        `SELECT oi.order_id, oi.product_id, oi.quantity, oi.unit_price, p.name, p.image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ANY($1::int[])
         ORDER BY oi.id`,
        [ids]
      );
      const historyResult = await pool.query(
        `SELECT order_id, from_status, to_status, changed_at
         FROM order_status_history
         WHERE order_id = ANY($1::int[])
         ORDER BY changed_at, id`,
        [ids]
      );
      items = itemsResult.rows;
      history = historyResult.rows;
    }

    // SFTWRKEY-449: envío y forma de entrega de cada pedido
    const orders = ordersResult.rows.map(({ shipping_cost, delivery_method, delivery_address, ...order }) => ({
      ...order,
      shipping: Number(shipping_cost ?? 0),
      delivery: deliveryView({ delivery_method, delivery_address }),
      items: items
        .filter((item) => item.order_id === order.id)
        .map(({ order_id, ...item }) => ({ ...item, name: item.name ?? item.product_id })),
      history: history
        .filter((h) => h.order_id === order.id)
        .map(({ order_id, ...h }) => h),
    }));

    // sin cache: si el admin cambia el estado, el cliente lo ve al recargar
    res.set("Cache-Control", "no-store").json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener el historial de pedidos" });
  }
});

// SFTWRKEY-321: Editar información personal
router.put("/user/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
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
router.put("/user/:userId/password", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), rateLimit({ windowMs: 60_000, max: 10, onBlock: onRateLimitBlock }), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Debes ingresar la contraseña actual y la nueva." });
  }
  // SFTWRKEY-409: política de contraseñas
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
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
router.get("/users/search", authenticate, requireRoles("ADMIN"), async (req, res) => {
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

export default router;