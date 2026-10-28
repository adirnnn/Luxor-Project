import { Router } from 'express';
import pool from '../db.js';
import { authenticate, authorizeSelfOrRoles, requireRoles } from '../services/auth.js';

// SFTWRKEY-431: reseñas y calificaciones. Solo el cliente que recibió el perfume (pedido
// 'entregado') puede calificarlo de 1 a 5, una vez por cada perfume de cada pedido.
// El admin puede ocultar y volver a mostrar reseñas. La tabla se crea en seed.js.
const router = Router();

// tiene que ser igual al VARCHAR(500) de reviews.comment en seed.js
export const COMMENT_MAX_LENGTH = 500;
const PUBLIC_LIMIT = 50;
const ID_REGEX = /^\d+$/;

// devuelve el id como numero, o null si no es un entero positivo
const parseId = (value) => {
  const id = Number(value);
  return ID_REGEX.test(String(value)) && Number.isSafeInteger(id) && id > 0 ? id : null;
};

// "María García López" -> "María G.": en la ficha no se publica el nombre completo del cliente
export const publicName = (name) => {
  const [first, second] = String(name ?? '').trim().split(/\s+/);
  if (!first) return 'Cliente';
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
};

// Valida el cuerpo de una reseña nueva. El comentario es opcional; vacío se guarda como NULL.
// El largo se cuenta en caracteres (Array.from) igual que el VARCHAR de PostgreSQL, no en UTF-16.
export function validateReview(body) {
  const { orderId, productId, rating, comment } = body ?? {};

  if (parseId(orderId) === null) {
    return { error: 'El pedido no es válido.' };
  }
  if (typeof productId !== 'string' || !productId.trim() || productId.length > 100) {
    return { error: 'El perfume no es válido.' };
  }
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'La calificación debe ser un número entero del 1 al 5.' };
  }
  if (comment !== undefined && comment !== null && typeof comment !== 'string') {
    return { error: 'El comentario debe ser texto.' };
  }
  const text = (comment ?? '').trim();
  if (Array.from(text).length > COMMENT_MAX_LENGTH) {
    return { error: `El comentario puede tener hasta ${COMMENT_MAX_LENGTH} caracteres.` };
  }

  return {
    value: { orderId: parseId(orderId), productId: productId.trim(), rating, comment: text || null },
  };
}

// Recalcula el promedio y la cantidad de reseñas visibles del perfume. Se llama dentro de la
// misma transacción que publica u oculta la reseña, así nunca quedan desfasados.
export async function refreshProductRating(db, productId) {
  const result = await db.query(
    `UPDATE products p
     SET rating_count = r.total, rating_avg = r.promedio
     FROM (
       SELECT COUNT(*)::int AS total, ROUND(AVG(rating), 2) AS promedio
       FROM reviews
       WHERE product_id = $1 AND hidden = FALSE
     ) r
     WHERE p.id = $1
     RETURNING p.rating_avg, p.rating_count`,
    [productId]
  );
  const row = result.rows[0];
  return {
    average: row?.rating_avg == null ? null : Number(row.rating_avg),
    count: row?.rating_count ?? 0,
  };
}

// ── Público: reseñas visibles de un perfume ──────────────────────────────────
router.get('/products/:id/reviews', async (req, res) => {
  try {
    const [summary, list] = await Promise.all([
      pool.query('SELECT rating_avg, rating_count FROM products WHERE id = $1', [req.params.id]),
      pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name
         FROM reviews r
         JOIN users u ON u.id = r.user_id
         WHERE r.product_id = $1 AND r.hidden = FALSE
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT $2`,
        [req.params.id, PUBLIC_LIMIT]
      ),
    ]);
    if (summary.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }

    const { rating_avg, rating_count } = summary.rows[0];
    res.json({
      success: true,
      average: rating_avg == null ? null : Number(rating_avg),
      count: rating_count ?? 0,
      // solo lo que se muestra: ni el correo ni el id del cliente salen de aquí
      reviews: list.rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        author: publicName(r.user_name),
      })),
    });
  } catch (err) {
    console.error('Error al obtener reseñas:', err.message);
    res.status(500).json({ success: false, message: 'Error al obtener las reseñas.' });
  }
});

// ── Cliente: sus reseñas (Mi cuenta las usa para saber qué perfumes ya calificó) ──
router.get('/user/:userId/reviews', authenticate, authorizeSelfOrRoles('userId', 'ADMIN'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, order_id, product_id, rating, comment, hidden, created_at
       FROM reviews
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.params.userId]
    );
    res.set('Cache-Control', 'no-store').json({ success: true, reviews: result.rows });
  } catch (err) {
    console.error('Error al obtener las reseñas del cliente:', err.message);
    res.status(500).json({ success: false, message: 'Error al obtener tus reseñas.' });
  }
});

// ── Cliente: publicar una reseña ─────────────────────────────────────────────
router.post('/reviews', authenticate, async (req, res) => {
  const { error, value } = validateReview(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }
  const { orderId, productId, rating, comment } = value;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // el perfume tiene que venir en ese pedido y el pedido tiene que ser del cliente
    const purchase = await client.query(
      `SELECT o.user_id, o.status
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND oi.product_id = $2
       LIMIT 1`,
      [orderId, productId]
    );
    const order = purchase.rows[0];
    // mismo mensaje si el pedido no existe o es de otro cliente: no se revela qué pedidos existen
    if (!order || req.user.id == null || String(order.user_id) !== String(req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Solo puedes calificar perfumes que compraste.' });
    }
    if (order.status !== 'entregado') {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Podrás calificar este perfume cuando tu pedido esté entregado.' });
    }

    const inserted = await client.query(
      `INSERT INTO reviews (order_id, product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (order_id, product_id) DO NOTHING
       RETURNING id, order_id, product_id, rating, comment, hidden, created_at`,
      [orderId, productId, req.user.id, rating, comment]
    );
    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Ya calificaste este perfume en este pedido.' });
    }

    const summary = await refreshProductRating(client, productId);
    await client.query('COMMIT');

    res.status(201).json({ success: true, review: inserted.rows[0], rating: summary });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al publicar la reseña:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo publicar la reseña.' });
  } finally {
    client.release();
  }
});

// ── Admin: lista de reseñas con filtro (visibles / ocultas) y paginación ─────
router.get('/admin/reviews', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const { status } = req.query;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  if (status !== undefined && status !== '' && status !== 'visible' && status !== 'hidden') {
    return res.status(400).json({ success: false, message: "El filtro debe ser 'visible' u 'hidden'." });
  }
  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ success: false, message: "El parámetro 'page' debe ser un entero mayor o igual a 1." });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ success: false, message: "El parámetro 'limit' debe ser un entero entre 1 y 50." });
  }

  // sin filtro va NULL y trae todas
  const hidden = status === 'hidden' ? true : status === 'visible' ? false : null;

  try {
    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM reviews r WHERE ($1::boolean IS NULL OR r.hidden = $1)`,
      [hidden]
    );
    const listResult = await pool.query(
      `SELECT r.id, r.order_id, r.product_id, r.rating, r.comment, r.hidden, r.created_at,
              p.name AS product_name, u.name AS user_name, u.email AS user_email
       FROM reviews r
       LEFT JOIN products p ON p.id = r.product_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE ($1::boolean IS NULL OR r.hidden = $1)
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT $2 OFFSET $3`,
      [hidden, limit, (page - 1) * limit]
    );

    const reviews = listResult.rows.map((r) => ({
      ...r,
      product_name: r.product_name ?? r.product_id,
    }));
    res.set('Cache-Control', 'no-store').json({ success: true, reviews, total: totalResult.rows[0].total, page, limit });
  } catch (err) {
    console.error('Error al listar reseñas:', err.message);
    res.status(500).json({ success: false, message: 'No se pudieron obtener las reseñas.' });
  }
});

// ── Admin: ocultar o volver a mostrar una reseña ─────────────────────────────
router.patch('/admin/reviews/:id', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'El id de la reseña no es válido.' });
  }
  const { hidden } = req.body ?? {};
  if (typeof hidden !== 'boolean') {
    return res.status(400).json({ success: false, message: "'hidden' debe ser true o false." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE reviews SET hidden = $1 WHERE id = $2
       RETURNING id, order_id, product_id, rating, comment, hidden, created_at`,
      [hidden, id]
    );
    if (updated.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Reseña no encontrada.' });
    }

    const review = updated.rows[0];
    const summary = await refreshProductRating(client, review.product_id);
    await client.query('COMMIT');

    res.json({ success: true, review, rating: summary });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error al cambiar la visibilidad de la reseña:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo actualizar la reseña.' });
  } finally {
    client.release();
  }
});

export default router;
