import { Router } from 'express';
import pool from '../db.js';
import { authenticate, requireRoles } from '../services/auth.js';
import { isValidStatus, canTransition, ORDER_TRANSITIONS } from '../services/orderStatus.js';

const router = Router();

const ORDER_ID_REGEX = /^\d+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// devuelve el id como numero, o null si no es un entero positivo
const parseOrderId = (value) => {
  const id = Number(value);
  return ORDER_ID_REGEX.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
};

// fecha YYYY-MM-DD que exista de verdad (2026-02-30 y 2026-13-01 no pasan)
const isValidDate = (value) => {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

// SFTWRKEY-419: lista de pedidos para el admin, con filtros por estado y fechas, y paginacion
router.get('/admin/orders', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const { status, from, to } = req.query;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  if (status !== undefined && status !== '' && !isValidStatus(status)) {
    return res.status(400).json({ success: false, message: "El estado del pedido no es válido." });
  }
  if ((from && !isValidDate(from)) || (to && !isValidDate(to))) {
    return res.status(400).json({ success: false, message: "Las fechas deben tener el formato AAAA-MM-DD." });
  }
  if (from && to && from > to) {
    return res.status(400).json({ success: false, message: "La fecha inicial no puede ser mayor que la final." });
  }
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ success: false, message: "El parámetro 'page' debe ser un entero mayor o igual a 1." });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ success: false, message: "El parámetro 'limit' debe ser un entero entre 1 y 50." });
  }

  // los filtros que no vienen van como NULL y no filtran; 'to' incluye todo ese dia
  const filters = [status || null, from || null, to || null];

  try {
    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM orders o
       WHERE ($1::text IS NULL OR o.status = $1)
         AND ($2::date IS NULL OR o.created_at >= $2::date)
         AND ($3::date IS NULL OR o.created_at < $3::date + 1)`,
      filters
    );

    const ordersResult = await pool.query(
      `SELECT o.id, o.created_at, o.total, o.status,
              u.name AS user_name, u.email AS user_email,
              g.guest_name, g.guest_email,
              (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id)::int AS items_count
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN guest_receipts g ON g.order_id = o.id
       WHERE ($1::text IS NULL OR o.status = $1)
         AND ($2::date IS NULL OR o.created_at >= $2::date)
         AND ($3::date IS NULL OR o.created_at < $3::date + 1)
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $4 OFFSET $5`,
      [...filters, limit, (page - 1) * limit]
    );

    const orders = ordersResult.rows.map((o) => ({
      id: o.id,
      created_at: o.created_at,
      total: Number(o.total),
      status: o.status,
      is_guest: !o.user_name,
      customer_name: o.user_name ?? (o.guest_name ? `Invitado · ${o.guest_name}` : "Invitado"),
      customer_email: o.user_email ?? o.guest_email ?? null,
      items_count: o.items_count,
    }));

    res.json({ success: true, orders, total: totalResult.rows[0].total, page, limit });
  } catch (err) {
    console.error("Error al listar pedidos:", err);
    res.status(500).json({ success: false, message: "No se pudieron obtener los pedidos." });
  }
});

// SFTWRKEY-419: detalle de un pedido con sus productos, historial y a que estados puede pasar
router.get('/admin/orders/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const id = parseOrderId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: "El id del pedido no es válido." });
  }

  try {
    const orderResult = await pool.query(
      `SELECT o.id, o.created_at, o.total, o.status,
              u.name AS user_name, u.email AS user_email,
              g.guest_name, g.guest_email, g.address
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN guest_receipts g ON g.order_id = o.id
       WHERE o.id = $1`,
      [id]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Pedido no encontrado." });
    }
    const o = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT oi.product_id, p.name, p.image, oi.quantity, oi.unit_price
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [id]
    );

    const historyResult = await pool.query(
      `SELECT h.from_status, h.to_status, h.changed_at, u.name AS changed_by_name
       FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.order_id = $1
       ORDER BY h.changed_at, h.id`,
      [id]
    );

    res.json({
      success: true,
      order: {
        id: o.id,
        created_at: o.created_at,
        total: Number(o.total),
        status: o.status,
        is_guest: !o.user_name,
        customer_name: o.user_name ?? (o.guest_name ? `Invitado · ${o.guest_name}` : "Invitado"),
        customer_email: o.user_email ?? o.guest_email ?? null,
        guest_address: o.address ?? null,
        items: itemsResult.rows.map((item) => ({
          product_id: item.product_id,
          name: item.name ?? item.product_id,
          image: item.image,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          subtotal: Number(item.unit_price) * item.quantity,
        })),
        history: historyResult.rows,
        allowedNextStatuses: ORDER_TRANSITIONS[o.status] ?? [],
      },
    });
  } catch (err) {
    console.error("Error al obtener el pedido:", err);
    res.status(500).json({ success: false, message: "No se pudo obtener el pedido." });
  }
});

// SFTWRKEY-417: el admin cambia el estado de un pedido, solo a un estado permitido
router.patch('/admin/orders/:id/status', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const id = parseOrderId(req.params.id);
  if (!id) {
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

    // SFTWRKEY-418: solo se actualiza si sigue en el estado que se leyo; si no, no se toca nada
    const updated = await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2 AND status = $3
       RETURNING id, user_id, total, status, created_at`,
      [status, id, from]
    );
    if (updated.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: "El pedido cambió mientras se actualizaba. Intenta de nuevo." });
    }

    // SFTWRKEY-418: al cancelar, las unidades del pedido regresan al stock.
    // Se suma por producto porque un pedido puede traer el mismo perfume en dos renglones.
    // Como 'cancelado' es final, repetir la peticion da 400 y el stock no se devuelve dos veces.
    if (status === 'cancelado') {
      await client.query(
        `UPDATE products p SET stock = p.stock + oi.quantity
         FROM (
           SELECT product_id, SUM(quantity) AS quantity
           FROM order_items
           WHERE order_id = $1
           GROUP BY product_id
         ) oi
         WHERE p.id = oi.product_id`,
        [id]
      );
    }

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
