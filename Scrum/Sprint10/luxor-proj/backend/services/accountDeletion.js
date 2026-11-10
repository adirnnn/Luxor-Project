// Borrar una cuenta (la borra el mismo cliente desde Mi cuenta o el admin desde Clientes).
// - Las cuentas de administrador nunca se borran.
// - Los pedidos, pagos e historial se quedan (son ventas y cuentan en los reportes), pero sin la
//   persona: se desligan de la cuenta y el pedido queda marcado como "Cuenta eliminada".
// - Carrito, favoritos, avisos, enlaces de correo, foto, cuenta de Google y reseñas se borran con la
//   cuenta (ON DELETE CASCADE); el promedio de estrellas de esos perfumes se vuelve a calcular.
import pool from '../db.js';
import { refreshProductRating } from '../routes/reviews.js';

export class AccountDeletionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let columnReady;
export const ensureDeletionColumns = (db = pool) => {
  if (!columnReady) {
    columnReady = db
      .query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS cuenta_eliminada BOOLEAN NOT NULL DEFAULT FALSE')
      .catch((err) => {
        columnReady = undefined;
        throw err;
      });
  }
  return columnReady;
};

export async function deleteAccount(userId, { db = pool } = {}) {
  await ensureDeletionColumns(db);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT u.id, r.nombre AS role FROM users u JOIN rol r ON r.id_rol = u.role WHERE u.id = $1 FOR UPDATE OF u`,
      [userId]
    );
    const user = found.rows[0];
    if (!user) throw new AccountDeletionError(404, 'La cuenta no existe.');
    if (user.role === 'ADMIN') throw new AccountDeletionError(403, 'Las cuentas de administrador no se pueden borrar.');

    // perfumes que la persona calificó: su promedio cambia al borrarse las reseñas
    const reseñados = (await client.query('SELECT to_regclass($1) AS t', ['reviews'])).rows[0].t
      ? (await client.query('SELECT DISTINCT product_id FROM reviews WHERE user_id = $1', [userId])).rows.map((r) => r.product_id)
      : [];

    await client.query('UPDATE orders SET user_id = NULL, cuenta_eliminada = TRUE WHERE user_id = $1', [userId]);
    // pagos, historial y pagos abiertos: algunas tablas se crean al usarse por primera vez
    const existe = async (tabla) => (await client.query('SELECT to_regclass($1) AS t', [tabla])).rows[0].t !== null;
    if (await existe('payments')) await client.query('UPDATE payments SET user_id = NULL WHERE user_id = $1', [userId]);
    if (await existe('order_status_history')) {
      await client.query('UPDATE order_status_history SET changed_by = NULL WHERE changed_by = $1', [userId]);
    }
    // un pago abierto sigue su curso (si se paga, el pedido se crea sin cuenta)
    if (await existe('checkout_sessions')) {
      await client.query('UPDATE checkout_sessions SET user_id = NULL WHERE user_id = $1', [userId]);
    }
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    for (const productId of reseñados) await refreshProductRating(client, productId);

    await client.query('COMMIT');
    return { deleted: true, reviewsRemoved: reseñados.length };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
