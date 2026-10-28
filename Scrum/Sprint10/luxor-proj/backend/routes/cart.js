import { Router } from 'express';
import pool from '../db.js';
import { authenticate, authorizeSelfOrRoles } from '../services/auth.js';

const router = Router();

// ── Carrito ───────────────────────────────────────────────────────────────────
router.get("/cart/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  try {
    const cartResult = await pool.query('SELECT id FROM carts WHERE user_id = $1', [req.params.userId]);
    if (cartResult.rows.length === 0) return res.json([]);
    const items = await pool.query('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [cartResult.rows[0].id]);
    res.json(items.rows);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

const MAX_QTY_PER_ITEM = 10;

function validateCartItems(items) {
  if (!Array.isArray(items)) {
    return "El body debe ser un arreglo de items del carrito.";
  }
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return "Cada item del carrito debe ser un objeto con product_id y quantity.";
    }
    if (!item.product_id || typeof item.product_id !== "string") {
      return "Cada item debe traer un product_id válido.";
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return "La cantidad de cada item debe ser un entero mayor a 0.";
    }
    // SFTWRKEY-391: mismo tope que el selector de cantidad del frontend (MAX_QTY_PER_ITEM).
    if (item.quantity > MAX_QTY_PER_ITEM) {
      return `La cantidad máxima por producto es ${MAX_QTY_PER_ITEM}.`;
    }
  }
  return null;
}

router.post("/cart/:userId", authenticate, authorizeSelfOrRoles("userId", "ADMIN"), async (req, res) => {
  const userId = req.params.userId;
  const items = req.body;
  const validationError = validateCartItems(items);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let cartResult = await client.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0)
      cartResult = await client.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
    const cartId = cartResult.rows[0].id;
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
    for (const item of items) {
      await client.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)', [cartId, item.product_id, item.quantity]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Error al sincronizar carrito:", err);
    res.status(500).json({ message: "Error" });
  } finally {
    client.release();
  }
});

export default router;