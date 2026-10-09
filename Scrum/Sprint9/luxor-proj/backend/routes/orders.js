import { Router } from 'express';
import pool from '../db.js';
import { authenticate, requireRoles } from '../services/auth.js';
import { isValidStatus, canTransition } from '../services/orderStatus.js';

const router = Router();

const ORDER_ID_REGEX = /^\d+$/;

// SFTWRKEY-417: el admin cambia el estado de un pedido, solo a un estado permitido
router.patch('/admin/orders/:id/status', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!ORDER_ID_REGEX.test(req.params.id) || !Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: "El id del pedido no es válido." });
  }

  const { status } = req.body ?? {};
  if (!isValidStatus(status)) {
    return res.status(400).json({ success: false, message: "El estado del pedido no es válido." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE para que dos cambios al mismo tiempo no se pisen
    const current = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Pedido no encontrado." });
    }

    const from = current.rows[0].status;
    if (!canTransition(from, status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `No se puede pasar de '${from}' a '${status}'.` });
    }

    const updated = await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2
       RETURNING id, user_id, total, status, created_at`,
      [status, id]
    );

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [id, from, status, req.user.id]
    );

    await client.query('COMMIT');

    const order = updated.rows[0];
    res.json({ success: true, order: { ...order, total: Number(order.total) } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Error al cambiar el estado del pedido:", err);
    res.status(500).json({ success: false, message: "No se pudo actualizar el estado del pedido." });
  } finally {
    client.release();
  }
});

export default router;
