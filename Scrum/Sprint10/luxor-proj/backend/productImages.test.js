// SFTWRKEY-457: fotos de productos subidas desde el panel (se pasan a WebP).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import sharp from 'sharp';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { default: app } = await import('./server.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Doble del pool de PostgreSQL (mismo patrón que carChekout.test.js)
function fakeDb(routes = []) {
  const log = [];
  const original = { query: pool.query, connect: pool.connect };
  const run = async (sql, params) => {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    log.push({ sql: text, params });
    for (const [pattern, respond] of routes) {
      if (pattern.test(text)) {
        const result = typeof respond === 'function' ? await respond(params, log) : respond;
        return result ?? { rows: [], rowCount: 0 };
      }
    }
    return { rows: [], rowCount: 0 };
  };
  pool.query = run;
  pool.connect = async () => ({ query: run, release() {} });
  return { log, restore: () => { pool.query = original.query; pool.connect = original.connect; } };
}

const adminToken = signToken({ id: 1, role: 'ADMIN' });
const clienteToken = signToken({ id: 7, role: 'CLIENTE' });

// foto de prueba como las de los perfumes viejos: PNG grande de 1600 px
const fotoPng = () =>
  sharp({ create: { width: 1600, height: 2000, channels: 3, background: { r: 200, g: 150, b: 60 } } }).png().toBuffer();

const subir = (body, { token = adminToken, tipo = 'image/png' } = {}) =>
  fetch(`${baseUrl}/admin/product-images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': tipo },
    body,
  });

const guardar = [/INSERT INTO product_images/i, { rows: [{ id: 12 }], rowCount: 1 }];

test('subir foto: sin sesión responde 401 y un CLIENTE recibe 403', async (t) => {
  const { log, restore } = fakeDb([guardar]);
  t.after(restore);
  const foto = await fotoPng();

  const sinToken = await fetch(`${baseUrl}/admin/product-images`, {
    method: 'POST', headers: { 'Content-Type': 'image/png' }, body: foto,
  });
  assert.equal(sinToken.status, 401);
  assert.equal((await subir(foto, { token: clienteToken })).status, 403);
  assert.equal(log.some((e) => /INSERT INTO product_images/i.test(e.sql)), false);
});

test('subir foto: un PNG de 1600 px se guarda como WebP de 800 px y devuelve una ruta local', async (t) => {
  const { log, restore } = fakeDb([guardar]);
  t.after(restore);
  const foto = await fotoPng();

  const res = await subir(foto);
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.image, '/product-images/12.webp');

  const insert = log.find((e) => /INSERT INTO product_images/i.test(e.sql));
  const guardada = insert.params[0];
  const meta = await sharp(guardada).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 1000, 'mantiene la proporción');
  assert.ok(guardada.length < foto.length, 'la foto guardada pesa menos que la original');
  assert.equal(body.size, guardada.length);
});

test('subir foto: un archivo que dice ser PNG pero no es imagen responde 400 y no se guarda', async (t) => {
  const { log, restore } = fakeDb([guardar]);
  t.after(restore);

  const res = await subir(Buffer.from('<script>alert(1)</script>'));

  assert.equal(res.status, 400);
  assert.equal(log.some((e) => /INSERT INTO product_images/i.test(e.sql)), false);
});

test('subir foto: un tipo que no es PNG, JPG ni WebP responde 400', async (t) => {
  const { restore } = fakeDb([guardar]);
  t.after(restore);

  assert.equal((await subir(Buffer.from('GIF89a'), { tipo: 'image/gif' })).status, 400);
  assert.equal((await subir(Buffer.alloc(0))).status, 400);
});

test('subir foto: un SVG con el Content-Type de PNG responde 400', async (t) => {
  const { log, restore } = fakeDb([guardar]);
  t.after(restore);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');

  assert.equal((await subir(svg)).status, 400);
  assert.equal(log.some((e) => /INSERT INTO product_images/i.test(e.sql)), false);
});

test('subir foto: más de 5 MB responde 413 con un mensaje claro', async (t) => {
  const { restore } = fakeDb([guardar]);
  t.after(restore);

  const res = await subir(Buffer.alloc(5 * 1024 * 1024 + 1));

  assert.equal(res.status, 413);
  assert.match((await res.json()).message, /5 MB/);
});

test('ver foto: responde la imagen WebP con caché de un año', async (t) => {
  const webp = await sharp(await fotoPng()).webp().toBuffer();
  const { restore } = fakeDb([[/FROM product_images WHERE id = \$1/i, (params) => ({ rows: params[0] === 12 ? [{ data: webp }] : [] })]]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/product-images/12.webp`);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/webp');
  assert.match(res.headers.get('cache-control'), /max-age=31536000/);
  assert.equal(Buffer.from(await res.arrayBuffer()).length, webp.length);
  assert.equal((await fetch(`${baseUrl}/product-images/99.webp`)).status, 404);
});

test('ver foto: la versión .jpg (para compartir en redes) sale en JPEG con caché de un año', async (t) => {
  const webp = await sharp(await fotoPng()).resize({ width: 800 }).webp().toBuffer();
  const { restore } = fakeDb([[/FROM product_images WHERE id = \$1/i, { rows: [{ data: webp }] }]]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/product-images/12.jpg`);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/jpeg');
  assert.match(res.headers.get('cache-control'), /max-age=31536000/);
  const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, 800);
});

test('ver foto: un 404 o un error no se guardan en caché (la CDN no debe recordar una foto rota)', async (t) => {
  let falla = false;
  const { restore } = fakeDb([[/FROM product_images WHERE id = \$1/i, () => {
    if (falla) throw new Error('base caída');
    return { rows: [] };
  }]]);
  t.after(restore);

  const noExiste = await fetch(`${baseUrl}/product-images/50.webp`);
  assert.equal(noExiste.status, 404);
  assert.equal(noExiste.headers.get('cache-control'), 'no-store');

  falla = true;
  const error = await fetch(`${baseUrl}/product-images/50.jpg`);
  assert.equal(error.status, 500);
  assert.equal(error.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await error.text(), /base caída/);

  const idMalo = await fetch(`${baseUrl}/product-images/abc.webp`);
  assert.equal(idMalo.headers.get('cache-control'), 'no-store');
});

test('ver foto: un id que no es número responde 404 sin consultar la base', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  for (const ruta of ['abc.webp', '-1.webp', '1.5.webp', "1'--.webp"]) {
    assert.equal((await fetch(`${baseUrl}/product-images/${ruta}`)).status, 404, ruta);
  }
  assert.equal(log.some((e) => /FROM product_images/i.test(e.sql)), false);
});
