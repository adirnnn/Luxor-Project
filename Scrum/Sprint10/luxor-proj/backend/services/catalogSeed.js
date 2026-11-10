// Carga el catálogo base (data/catalogo.js) en la base. Está aparte de seed.js porque seed.js corre
// apenas se importa: así las pruebas pueden revisar estas consultas sin tocar una base real.
import { catalogo as CATALOGO, SIN_FOTO } from '../data/catalogo.js';
import { retirados as RETIRADOS } from '../data/catalogoRetirados.js';

const COLUMNAS = `
  id text, name text, brand text, price numeric, stock integer, category text, image text,
  description text, salida text, corazon text, fondo text`;

// Una sola consulta para todo el catálogo. Un perfume que ya existe no se toca (DO NOTHING):
// precio, stock, notas y categoría los maneja el admin desde el panel.
// La categoría se busca por nombre, así no depende del id que le tocó en cada base.
export const INSERT_CATALOGO = `
  INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo, category_id, brand)
  SELECT p.id, p.name, p.price, COALESCE(p.image, $2), p.description, p.stock, p.salida, p.corazon, p.fondo, c.id, p.brand
  FROM jsonb_to_recordset($1::jsonb) AS p(${COLUMNAS})
  LEFT JOIN categories c ON c.nombre = p.category
  ON CONFLICT (id) DO NOTHING`;

// Fotos del catálogo (por ejemplo, links de Cloudinary): solo reemplazan la de relleno o una foto
// local del sitio (/assets/products/...). Una foto que el admin puso desde el panel (otro link https
// o una subida en /product-images/) nunca se pisa.
export const UPDATE_FOTOS = `
  UPDATE products pr SET image = p.image
  FROM jsonb_to_recordset($1::jsonb) AS p(${COLUMNAS})
  WHERE pr.id = p.id
    AND p.image IS NOT NULL
    AND pr.image IS DISTINCT FROM p.image
    AND (pr.image IS NULL OR pr.image = $2 OR pr.image LIKE '/assets/products/%')`;

export async function seedCatalog(db, catalogo = CATALOGO) {
  const datos = JSON.stringify(catalogo);
  const insertados = await db.query(INSERT_CATALOGO, [datos, SIN_FOTO]);
  const fotos = await db.query(UPDATE_FOTOS, [datos, SIN_FOTO]);
  return { total: catalogo.length, insertados: insertados.rowCount, fotos: fotos.rowCount };
}

// Perfumes que se quitaron del sitio por no tener foto (data/catalogoRetirados.js). Se borran solo si
// siguen sin foto (si el admin les puso una, se quedan) y no están en ningún pedido (order_items no
// borra en cascada: el historial de pedidos se conserva). Carrito, favoritos y avisos se borran solos.
export const DELETE_RETIRADOS = `
  DELETE FROM products p
  WHERE p.id = ANY($1::text[])
    AND (p.image IS NULL OR p.image = $2)
    AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id)
  RETURNING p.id`;

export async function removeRetired(db, retirados = RETIRADOS) {
  if (retirados.length === 0) return { borrados: 0 };
  const result = await db.query(DELETE_RETIRADOS, [retirados, SIN_FOTO]);
  return { borrados: result.rowCount };
}
