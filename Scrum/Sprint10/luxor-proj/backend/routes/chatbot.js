import { Router } from 'express';
import pool from '../db.js';
import { requireInternalKey } from '../services/internalKey.js';

const router = Router();

// Historial de preguntas y respuestas del chatbot
// SFTWRKEY-293: Registrar consultas del chatbot
const ensureChatbotQueriesTable = () => pool.query(`
  CREATE TABLE IF NOT EXISTS chatbot_queries (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    response TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

// SFTWRKEY-380: solo el chatbot puede registrar consultas (cabecera X-Internal-Key).
router.post("/chatbot/queries", requireInternalKey, async (req, res) => {
    const { query, response } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "La consulta es requerida."
      });
    }

    try {
      await ensureChatbotQueriesTable();
      const result = await pool.query(
        `INSERT INTO chatbot_queries (query, response)
        VALUES ($1, $2)
        RETURNING id, query, response, created_at`,
        [query, response || null]
      );

      return res.status(201).json({
        success: true,
        query: result.rows[0]
      });

    } catch (err) {
      console.error("Error registrando consulta del chatbot:", err);

      return res.status(500).json({
        success: false,
        message: "No se pudo registrar la consulta."
      });
    }
});

export default router;