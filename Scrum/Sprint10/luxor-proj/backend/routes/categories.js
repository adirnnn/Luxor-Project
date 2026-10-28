import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// SFTWRKEY-275: Listar categorías disponibles (para poblar el filtro en el frontend)
router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre FROM categories ORDER BY nombre ASC');
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al obtener categorías" });
  }
});

export default router;