import { Router } from 'express';
import pool from '../db.js';
import { authenticate, authorizeSelfOrRoles } from '../services/auth.js';

// SFTWRKEY-429: lista de deseos. Cada usuario ve y cambia solo la suya (o un ADMIN).
const router = Router();

let tableReady;
const ensureTable = () => {
  if (!tableReady) {
    tableReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS wishlist_items (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, product_id)
        )
      `)
      .catch((err) => {
        tableReady = undefined;
        throw err;
      });
  }
  return tableReady;
};

const guard = [authenticate, authorizeSelfOrRoles('userId', 'ADMIN')];

router.get('/wishlist/:userId', ...guard, async (req, res) => {
  try {
    await ensureTable();
    const result = await pool.query(
      `SELECT p.*, c.nombre AS category_name
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [req.params.userId]
    );
    const items = result.rows.map((p) => ({
      ...p,
      notes: { salida: p.salida, corazon: p.corazon, fondo: p.fondo },
    }));
    res.json({ success: true, items });
  } catch (err) {
    console.error('Error al leer la lista de deseos:', err.message);
    res.status(500).json({ success: false, message: 'Error al obtener la lista de deseos.' });
  }
});

router.post('/wishlist/:userId', ...guard, async (req, res) => {
  const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
  if (!productId || productId.length > 100) {
    return res.status(400).json({ success: false, message: 'productId es requerido.' });
  }

  try {
    await ensureTable();
    await pool.query(
      `INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [req.params.userId, productId]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    // 23503: el producto (o el usuario) no existe
    if (err.code === '23503') {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }
    console.error('Error al agregar a la lista de deseos:', err.message);
    res.status(500).json({ success: false, message: 'Error al agregar a la lista de deseos.' });
  }
});

router.delete('/wishlist/:userId/:productId', ...guard, async (req, res) => {
  try {
    await ensureTable();
    await pool.query('DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [
      req.params.userId,
      req.params.productId,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al quitar de la lista de deseos:', err.message);
    res.status(500).json({ success: false, message: 'Error al quitar de la lista de deseos.' });
  }
});

export default router;
