import { Router } from 'express';
import pool from '../db.js';
import { authenticate, requireRoles } from '../services/auth.js';
import {
  WHOLESALE_ROLE,
  MIN_WHOLESALE_PERCENT,
  MAX_WHOLESALE_PERCENT,
  getWholesalePercent,
  setWholesalePercent,
  isValidWholesalePercent,
} from '../services/wholesale.js';

// Feedback del cliente: el admin define el porcentaje de los mayoristas y decide qué clientes lo
// son. Solo cambia entre CLIENTE y MAYORISTA: desde aquí nunca se toca una cuenta de ADMIN.
const router = Router();
const CUSTOMER_ROLES = ['CLIENTE', WHOLESALE_ROLE];
const SEARCH_LIMIT = 20;

const listWholesale = () =>
  pool.query(
    `SELECT u.id, u.name, u.email, r.nombre AS role
     FROM users u JOIN rol r ON r.id_rol = u.role
     WHERE r.nombre = $1
     ORDER BY u.name`,
    [WHOLESALE_ROLE]
  );

router.get('/admin/wholesale', authenticate, requireRoles('ADMIN'), async (_req, res) => {
  try {
    const [percent, customers] = await Promise.all([getWholesalePercent(pool), listWholesale()]);
    res.set('Cache-Control', 'no-store').json({ success: true, percent, customers: customers.rows });
  } catch (err) {
    console.error('Error leyendo los mayoristas:', err.message);
    res.status(500).json({ success: false, message: 'No se pudieron cargar los mayoristas.' });
  }
});

router.put('/admin/wholesale', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const percent = Number(req.body?.percent);
  if (!isValidWholesalePercent(percent)) {
    return res.status(400).json({
      success: false,
      message: `El porcentaje debe ser un número entero entre ${MIN_WHOLESALE_PERCENT} y ${MAX_WHOLESALE_PERCENT}.`,
    });
  }
  try {
    await setWholesalePercent(pool, percent);
    res.json({ success: true, percent });
  } catch (err) {
    console.error('Error guardando el porcentaje de mayoristas:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo guardar el porcentaje.' });
  }
});

// clientes (y mayoristas) por nombre o correo, para asignarles el rol
router.get('/admin/customers', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    return res.status(400).json({ success: false, message: 'Escribe al menos 2 letras del nombre o del correo.' });
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, r.nombre AS role
       FROM users u JOIN rol r ON r.id_rol = u.role
       WHERE r.nombre = ANY($1::text[]) AND (u.name ILIKE $2 OR u.email ILIKE $2)
       ORDER BY u.name
       LIMIT $3`,
      [CUSTOMER_ROLES, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, SEARCH_LIMIT]
    );
    res.set('Cache-Control', 'no-store').json({ success: true, customers: result.rows });
  } catch (err) {
    console.error('Error buscando clientes:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo buscar.' });
  }
});

router.patch('/admin/users/:id/role', authenticate, requireRoles('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const role = req.body?.role;
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: 'El usuario no es válido.' });
  }
  if (!CUSTOMER_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'El rol debe ser CLIENTE o MAYORISTA.' });
  }
  try {
    // solo se actualiza si el usuario hoy es cliente o mayorista (nunca un ADMIN)
    const result = await pool.query(
      `UPDATE users u SET role = (SELECT id_rol FROM rol WHERE nombre = $2)
       WHERE u.id = $1
         AND u.role IN (SELECT id_rol FROM rol WHERE nombre = ANY($3::text[]))
       RETURNING u.id, u.name, u.email`,
      [id, role, CUSTOMER_ROLES]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No encontramos ese cliente.' });
    }
    res.json({ success: true, customer: { ...result.rows[0], role } });
  } catch (err) {
    console.error('Error cambiando el rol:', err.message);
    res.status(500).json({ success: false, message: 'No se pudo cambiar el rol.' });
  }
});

export default router;
