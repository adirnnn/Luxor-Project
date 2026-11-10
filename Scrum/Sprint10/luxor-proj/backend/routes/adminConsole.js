import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { authenticate, requireRoles, clearSessionCookie } from '../services/auth.js';
import { rateLimit } from '../services/rateLimit.js';
import { notifyRestock } from '../services/restockAlerts.js';
import { deleteAccount, ensureDeletionColumns, AccountDeletionError } from '../services/accountDeletion.js';

// Consola del administrador: resumen, inventario con filtros, clientes y borrar cuentas.
const router = Router();
const soloAdmin = [authenticate, requireRoles('ADMIN')];

// "stock bajo" = última unidad: la tienda tiene 1 o 2 piezas de la mitad de sus perfumes, así que con
// un número mayor el filtro marcaba casi todo el catálogo. Con 1, la siguiente venta lo agota.
export const LOW_STOCK = 1;
const PAGE_SIZES = [25, 50, 100];

const texto = (v, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pageOf = (v) => Math.max(1, Number.parseInt(v, 10) || 1);
const sizeOf = (v) => (PAGE_SIZES.includes(Number(v)) ? Number(v) : 25);

// ── Resumen ────────────────────────────────────────────────────────────────────
router.get('/admin/summary', ...soloAdmin, async (_req, res) => {
  try {
    const [stock, pedidos, hoy, clientes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE stock <= 0)::int AS agotados,
                COUNT(*) FILTER (WHERE stock > 0 AND stock <= $1)::int AS bajo
         FROM products`,
        [LOW_STOCK]
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'pagado')::int AS por_preparar,
                COUNT(*) FILTER (WHERE status = 'en_preparacion')::int AS en_preparacion,
                COUNT(*) FILTER (WHERE status = 'enviado')::int AS enviados
         FROM orders`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS pedidos, COALESCE(SUM(total), 0)::float AS ventas
         FROM orders
         WHERE status <> 'cancelado' AND created_at >= date_trunc('day', NOW())`
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE r.nombre <> 'ADMIN')::int AS total,
                COUNT(*) FILTER (WHERE r.nombre <> 'ADMIN' AND u.created_at >= NOW() - interval '7 days')::int AS nuevos
         FROM users u JOIN rol r ON r.id_rol = u.role`
      ),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      lowStock: LOW_STOCK,
      productos: stock.rows[0],
      pedidos: pedidos.rows[0],
      hoy: hoy.rows[0],
      clientes: clientes.rows[0],
    });
  } catch (err) {
    console.error('Error en el resumen del admin:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo cargar el resumen.' });
  }
});

// ── Inventario ─────────────────────────────────────────────────────────────────
const ORDENES = {
  nombre: 'p.name ASC',
  precio_asc: 'p.price ASC, p.name ASC',
  precio_desc: 'p.price DESC, p.name ASC',
  stock_asc: 'p.stock ASC, p.name ASC',
  stock_desc: 'p.stock DESC, p.name ASC',
  marca: 'p.brand ASC NULLS LAST, p.name ASC',
};
const STOCK_FILTROS = {
  agotado: 'p.stock <= 0',
  bajo: `p.stock > 0 AND p.stock <= ${LOW_STOCK}`,
  disponible: `p.stock > ${LOW_STOCK}`,
};

export function parseInventoryParams(query) {
  const stock = Object.hasOwn(STOCK_FILTROS, query.stock) ? query.stock : '';
  const sort = Object.hasOwn(ORDENES, query.sort) ? query.sort : 'nombre';
  const categoryId = Number.parseInt(query.category, 10);
  return {
    q: texto(query.q),
    stock,
    category: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
    brand: texto(query.brand, 150),
    sort,
    page: pageOf(query.page),
    pageSize: sizeOf(query.pageSize),
  };
}

// condiciones comunes (todo menos el filtro de stock, para poder contar cada grupo)
function inventoryWhere({ q, category, brand }) {
  const params = [];
  const conds = [];
  if (q) {
    params.push(`%${q}%`);
    conds.push(`(p.name ILIKE $${params.length} OR p.brand ILIKE $${params.length} OR p.id ILIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    conds.push(`p.category_id = $${params.length}`);
  }
  if (brand) {
    params.push(brand);
    conds.push(`p.brand = $${params.length}`);
  }
  return { params, sql: conds.length ? conds.join(' AND ') : 'TRUE' };
}

router.get('/admin/products', ...soloAdmin, async (req, res) => {
  const f = parseInventoryParams(req.query);
  const base = inventoryWhere(f);
  const stockCond = f.stock ? STOCK_FILTROS[f.stock] : 'TRUE';
  try {
    const counts = await pool.query(
      `SELECT COUNT(*)::int AS todos,
              COUNT(*) FILTER (WHERE ${STOCK_FILTROS.agotado})::int AS agotado,
              COUNT(*) FILTER (WHERE ${STOCK_FILTROS.bajo})::int AS bajo,
              COUNT(*) FILTER (WHERE ${STOCK_FILTROS.disponible})::int AS disponible
       FROM products p WHERE ${base.sql}`,
      base.params
    );
    const params = [...base.params, f.pageSize, (f.page - 1) * f.pageSize];
    const items = await pool.query(
      `SELECT p.id, p.name, p.brand, p.price::float AS price, p.stock, p.image, c.nombre AS category
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${base.sql} AND ${stockCond}
       ORDER BY ${ORDENES[f.sort]}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const c = counts.rows[0];
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      items: items.rows,
      total: f.stock ? c[f.stock] : c.todos,
      page: f.page,
      pageSize: f.pageSize,
      counts: c,
      lowStock: LOW_STOCK,
    });
  } catch (err) {
    console.error('Error listando el inventario:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo cargar el inventario.' });
  }
});

// cambiar solo el stock desde la tabla (si un agotado vuelve a tener, se avisa a quien lo pidió)
router.patch('/admin/products/:id/stock', ...soloAdmin, async (req, res) => {
  const stock = Number(req.body?.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
    return res.status(400).json({ success: false, message: 'El stock debe ser un número entero de 0 en adelante.' });
  }
  try {
    const result = await pool.query(
      `UPDATE products p SET stock = $1
       FROM (SELECT stock AS antes FROM products WHERE id = $2) a
       WHERE p.id = $2
       RETURNING p.id, p.stock, a.antes`,
      [stock, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    const { antes } = result.rows[0];
    // SFTWRKEY-450: igual que al editar el perfume completo
    if (stock > 0 && antes <= 0) void notifyRestock([req.params.id]);
    res.json({ success: true, stock, antes });
  } catch (err) {
    console.error('Error cambiando el stock:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo cambiar el stock.' });
  }
});

// ── Clientes ───────────────────────────────────────────────────────────────────
router.get('/admin/users', ...soloAdmin, async (req, res) => {
  const q = texto(req.query.q);
  const role = ['CLIENTE', 'MAYORISTA', 'ADMIN'].includes(req.query.role) ? req.query.role : '';
  const page = pageOf(req.query.page);
  const pageSize = sizeOf(req.query.pageSize);
  const params = [q ? `%${q}%` : null, role || null];
  const where = `($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1) AND ($2::text IS NULL OR r.nombre = $2)`;
  try {
    const total = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users u JOIN rol r ON r.id_rol = u.role WHERE ${where}`,
      params
    );
    const rows = await pool.query(
      `SELECT u.id, u.name, u.email, r.nombre AS role, u.created_at,
              COALESCE((to_jsonb(u) ->> 'email_verified')::boolean, TRUE) AS email_verified,
              (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS pedidos,
              (SELECT COALESCE(SUM(o.total), 0)::float FROM orders o WHERE o.user_id = u.id AND o.status <> 'cancelado') AS gastado,
              (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS ultimo_pedido
       FROM users u JOIN rol r ON r.id_rol = u.role
       WHERE ${where}
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT $3 OFFSET $4`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, users: rows.rows, total: total.rows[0].total, page, pageSize });
  } catch (err) {
    console.error('Error listando clientes:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo cargar la lista de clientes.' });
  }
});

const responderError = (res, err, accion) => {
  if (err instanceof AccountDeletionError) return res.status(err.status).json({ success: false, message: err.message });
  console.error(`Error ${accion}:`, err.message);
  return res.status(500).json({ success: false, message: 'No se pudo borrar la cuenta.' });
};

// el admin borra la cuenta de un cliente o mayorista (nunca la de un admin)
router.delete('/admin/users/:id', ...soloAdmin, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Cuenta inválida.' });
  try {
    await deleteAccount(id);
    res.json({ success: true, message: 'La cuenta se borró.' });
  } catch (err) {
    responderError(res, err, 'borrando la cuenta desde el panel');
  }
});

// el cliente borra su propia cuenta desde Mi cuenta. Confirma con su contraseña; las cuentas creadas
// con Google (no tienen una contraseña que la persona conozca) confirman escribiendo ELIMINAR.
router.delete(
  '/me',
  authenticate,
  rateLimit({ windowMs: 15 * 60_000, max: 5 }),
  async (req, res) => {
    try {
      await ensureDeletionColumns();
      const found = await pool.query(
        `SELECT u.password, r.nombre AS role FROM users u JOIN rol r ON r.id_rol = u.role WHERE u.id = $1`,
        [req.user.id]
      );
      const hayGoogle = (await pool.query("SELECT to_regclass('google_accounts') AS t")).rows[0].t !== null;
      const conCuentaGoogle = hayGoogle
        ? (await pool.query('SELECT 1 FROM google_accounts WHERE user_id = $1', [req.user.id])).rows.length > 0
        : false;
      const user = found.rows[0];
      if (!user) return res.status(404).json({ success: false, message: 'La cuenta no existe.' });
      if (user.role === 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Las cuentas de administrador no se pueden borrar.' });
      }
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const confirmacion = typeof req.body?.confirm === 'string' ? req.body.confirm.trim() : '';
      const conClave = password && (await bcrypt.compare(password, user.password));
      const conGoogle = conCuentaGoogle && confirmacion === 'ELIMINAR';
      if (!conClave && !conGoogle) {
        return res.status(401).json({
          success: false,
          message: conCuentaGoogle ? 'Escribe ELIMINAR para confirmar.' : 'La contraseña no es correcta.',
        });
      }
      await deleteAccount(req.user.id);
      clearSessionCookie(res);
      res.json({ success: true, message: 'Tu cuenta se borró.' });
    } catch (err) {
      responderError(res, err, 'borrando la propia cuenta');
    }
  }
);

export default router;
