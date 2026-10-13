import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// SFTWRKEY-430: productos relacionados. Primero los de la misma categoría, luego los de la
// misma marca, y entre ellos los de precio más parecido. Solo con stock y sin el producto actual.
router.get("/products/:id/related", async (req, res) => {
  const requested = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, 12) : 4;

  try {
    const result = await pool.query(
      `SELECT p.*, c.nombre AS category_name
       FROM products base
       JOIN products p ON p.id <> base.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE base.id = $1 AND p.stock > 0
       ORDER BY
         (base.category_id IS NOT NULL AND p.category_id = base.category_id) DESC,
         (base.brand IS NOT NULL AND p.brand = base.brand) DESC,
         ABS(p.price - base.price) ASC,
         p.id ASC
       LIMIT $2`,
      [req.params.id, limit]
    );
    const items = result.rows.map((p) => ({
      ...p,
      notes: { salida: p.salida, corazon: p.corazon, fondo: p.fondo },
    }));
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener productos relacionados" });
  }
});

export default router;
