import { Router } from 'express';
import pool from '../db.js';
import { authenticate, requireRoles } from '../services/auth.js';
import { CSV_TEMPLATE, validateCsv, CsvValidationError } from '../csvImport.js';

const router = Router();

const ensureImportHistoryTable = () => pool.query(`
  CREATE TABLE IF NOT EXISTS product_imports (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    rejected_rows INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

const saveImportHistory = async ({ fileName, totalRows, importedRows, errors }) => {
  await ensureImportHistoryTable();
  const result = await pool.query(
    `INSERT INTO product_imports (file_name, total_rows, imported_rows, rejected_rows, errors)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, file_name, total_rows, imported_rows, rejected_rows, errors, created_at`,
    [fileName, totalRows, importedRows, new Set(errors.map((error) => error.row)).size, JSON.stringify(errors)]
  );
  return result.rows[0];
};

// SFTWRKEY-277..282: formato, lectura, validación, importación e historial CSV.
router.get("/imports/products/template", authenticate, requireRoles("ADMIN"), (_req, res) => {
  res.type("text/csv").attachment("plantilla-perfumes.csv").send(CSV_TEMPLATE);
});

router.get("/imports/products", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    await ensureImportHistoryTable();
    const result = await pool.query(
      `SELECT id, file_name, total_rows, imported_rows, rejected_rows, errors, created_at
       FROM product_imports ORDER BY created_at DESC, id DESC LIMIT 50`
    );
    res.json({ success: true, imports: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "No se pudo consultar el historial de importaciones." });
  }
});

router.post("/imports/products", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { fileName = "importacion.csv", csv } = req.body ?? {};
  if (typeof fileName !== "string" || !fileName.toLowerCase().endsWith(".csv")) {
    return res.status(400).json({ success: false, message: "Debe seleccionar un archivo con extensión .csv." });
  }
  try {
    const parsed = validateCsv(csv);
    const errors = [...parsed.errors];
    const ids = parsed.products.map((product) => product.id);
    const existing = await pool.query("SELECT id FROM products WHERE id = ANY($1::varchar[])", [ids]);
    const existingIds = new Set(existing.rows.map((product) => product.id.toLowerCase()));
    parsed.products.forEach((product) => {
      if (existingIds.has(product.id.toLowerCase())) {
        errors.push({ row: product.row, field: "id", message: "Ya existe un perfume con este identificador." });
      }
    });
    const rejectedRows = new Set(errors.map((error) => error.row));
    const validProducts = parsed.products.filter((product) => !rejectedRows.has(product.row));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const product of validProducts) {
        await client.query(
          `INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [product.id, product.name, product.price, product.image || null, product.description || null,
            product.stock, product.salida || null, product.corazon || null, product.fondo || null]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    const history = await saveImportHistory({ fileName: fileName.slice(0, 255), totalRows: parsed.totalRows, importedRows: validProducts.length, errors });
    res.status(201).json({ success: true, message: "Importación procesada.", summary: history });
  } catch (err) {
    if (err instanceof CsvValidationError) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error(err);
    res.status(500).json({ success: false, message: "No se pudo procesar el archivo CSV." });
  }
});

export default router;