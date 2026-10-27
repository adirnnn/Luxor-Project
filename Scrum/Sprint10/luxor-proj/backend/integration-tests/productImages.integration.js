// Integración: SFTWRKEY-457, el admin sube una foto, se guarda como WebP en PostgreSQL real
// y se puede usar como imagen de un producto. También revisa que el seed pase las rutas viejas a .webp.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { startServer, stopServer, api, apiUrl, insertProduct, cleanup, pool, loginAdmin } from './helpers.js';

const created = { users: [], products: [] };
const fotos = [];
let adminToken;

before(async () => {
  await startServer();
  adminToken = await loginAdmin();
});
after(async () => {
  await pool.query('DELETE FROM product_images WHERE id = ANY($1::int[])', [fotos]);
  await cleanup(created);
  await stopServer();
});

test('el admin sube un PNG, se guarda como WebP y se usa como imagen de un producto', async () => {
  const png = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#c9a24a' } }).png().toBuffer();

  const subida = await fetch(apiUrl('/admin/product-images'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'image/png' },
    body: png,
  });
  assert.equal(subida.status, 201);
  const { image } = await subida.json();
  assert.match(image, /^\/product-images\/\d+\.webp$/);
  fotos.push(Number(image.match(/\d+/)[0]));

  // la foto sale de la base tal cual se guardó
  const foto = await fetch(apiUrl(image));
  assert.equal(foto.status, 200);
  assert.equal(foto.headers.get('content-type'), 'image/webp');
  const meta = await sharp(Buffer.from(await foto.arrayBuffer())).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 800);

  // la ruta pasa la validación de imágenes (SFTWRKEY-379) al crear el producto
  const id = `it-foto-${Date.now()}`;
  created.products.push(id);
  const nuevo = await api('POST', '/products', {
    token: adminToken,
    body: { id, name: 'Perfume con foto subida', price: 300, stock: 2, image, description: 'Prueba', category_id: 2, notes: {} },
  });
  assert.equal(nuevo.status, 201);
  const { rows } = await pool.query('SELECT image FROM products WHERE id = $1', [id]);
  assert.equal(rows[0].image, image);
});

test('el seed pasa las rutas .png y .jpg de public/assets/products a .webp y no toca las demás', async () => {
  const png = await insertProduct(created.products);
  const jpg = await insertProduct(created.products);
  const externa = await insertProduct(created.products);
  const subida = await insertProduct(created.products);
  await pool.query('UPDATE products SET image = $2 WHERE id = $1', [png.id, '/assets/products/lattafaKhamrah.png']);
  await pool.query('UPDATE products SET image = $2 WHERE id = $1', [jpg.id, '/assets/products/asad.jpg']);
  await pool.query('UPDATE products SET image = $2 WHERE id = $1', [externa.id, 'https://cdn.example.com/foto.png']);
  await pool.query('UPDATE products SET image = $2 WHERE id = $1', [subida.id, '/product-images/5.webp']);

  const seedPath = fileURLToPath(new URL('../seed.js', import.meta.url));
  const seed = spawnSync(process.execPath, [seedPath], { env: process.env, encoding: 'utf8' });
  assert.equal(seed.status, 0, seed.stderr);

  const imagen = async (id) => (await pool.query('SELECT image FROM products WHERE id = $1', [id])).rows[0].image;
  assert.equal(await imagen(png.id), '/assets/products/lattafaKhamrah.webp');
  assert.equal(await imagen(jpg.id), '/assets/products/asad.webp');
  assert.equal(await imagen(externa.id), 'https://cdn.example.com/foto.png');
  assert.equal(await imagen(subida.id), '/product-images/5.webp');
  assert.equal(await imagen('khamrah'), '/assets/products/lattafaKhamrah.webp');
});
