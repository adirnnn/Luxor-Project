// registro de errores de sincronizacion con PerfumAPI.
// mismo patron que product_imports en server.js: se asegura la tabla antes de usarla, por si el backend arranca sin haber corrido seed.js.
import pool from '../db.js';

const ensureSyncLogTable = () => pool.query(`
  CREATE TABLE IF NOT EXISTS perfum_api_sync_logs (
    id SERIAL PRIMARY KEY,
    query VARCHAR(255),
    external_id VARCHAR(100),
    error_message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

/**
 * registra un fallo de sincronizacion con PerfumAPI (llamada de red, mapeo
 * o validacion). No relanza: un fallo al loguear no debe tumbar la
 * respuesta al admin.
 */
export async function logSyncError({ query = null, externalId = null, errorMessage }) {
  try {
    await ensureSyncLogTable();
    await pool.query(
      `INSERT INTO perfum_api_sync_logs (query, external_id, error_message) VALUES ($1, $2, $3)`,
      [query, externalId, errorMessage]
    );
  } catch (err) {
    console.error('No se pudo registrar el error de sincronizacion con PerfumAPI:', err);
  }
}

export async function listSyncLogs(limit = 50) {
  await ensureSyncLogTable();
  const result = await pool.query(
    `SELECT id, query, external_id, error_message, created_at
     FROM perfum_api_sync_logs ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
