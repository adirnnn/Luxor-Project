import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

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

// Doble del pool de PostgreSQL
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

// Patrones de las consultas que emiten las rutas de productos.
const Q = {
  listar: /FROM products p LEFT JOIN categories c ON p\.category_id = c\.id ORDER BY p\.created_at DESC/i,
  buscar: /WHERE p\.stock > 0/i,
  porId: /WHERE p\.id = \$1/i,
  categorias: /SELECT id, nombre FROM categories/i,
  insertar: /^INSERT INTO products/i,
  actualizar: /^UPDATE products SET/i,
  borrar: /^DELETE FROM products WHERE id = \$1$/i,
};

const adminToken = signToken({ id: 1, role: 'ADMIN' });
const pedir = (metodo, ruta, body) =>
  fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const PRODUCTO_VALIDO = {
  id: 'khamrah-lattafa',
  name: 'Khamrah',
  price: '390.00',
  stock: 10,
  notes: { salida: 'Canela', corazon: 'Dátil', fondo: 'Vainilla' },
  category_id: 2,
};

// ── GET /products (listado público) ────────────────────────────────────────

test('GET /products: no requiere autenticación y arma "notes" desde salida/corazon/fondo', async (t) => {
  const { restore } = fakeDb([
    [Q.listar, {
      rows: [{ id: 'khamrah', name: 'Khamrah', price: '390.00', salida: 'Canela', corazon: 'Dátil', fondo: 'Vainilla' }],
    }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/products`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body[0].notes, { salida: 'Canela', corazon: 'Dátil', fondo: 'Vainilla' });
});

test('GET /products: error de base de datos responde 500', async (t) => {
  const { restore } = fakeDb([[Q.listar, () => { throw new Error('fallo de conexión'); }]]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/products`);
  assert.equal(res.status, 500);
});

// ── GET /categories ─────────────────────────────────────────────────────────

test('GET /categories: devuelve la lista de categorías', async (t) => {
  const { restore } = fakeDb([
    [Q.categorias, { rows: [{ id: 1, nombre: 'Árabes' }, { id: 2, nombre: 'Occidentales' }] }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/categories`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.categories.length, 2);
});

// ── GET /products/search ────────────────────────────────────────────────────

test('GET /products/search: sin parámetro "busqueda" responde 400', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await fetch(`${baseUrl}/products/search`);
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(log.length, 0);
});

test('GET /products/search: solo espacios en blanco también responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await fetch(`${baseUrl}/products/search?busqueda=%20%20`);
  assert.equal(res.status, 400);
});

test('GET /products/search: busca solo entre productos con stock y arma "notes"', async (t) => {
  const { log, restore } = fakeDb([
    [Q.buscar, { rows: [{ id: 'khamrah', name: 'Khamrah', salida: 'Canela', corazon: '', fondo: '' }] }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/products/search?busqueda=kham`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.products[0].notes.salida, 'Canela');
  assert.deepEqual(log[0].params, ['%kham%']);
});

// ── GET /products/:id ────────────────────────────────────────────────────────

test('GET /products/:id: producto inexistente responde 404', async (t) => {
  const { restore } = fakeDb([[Q.porId, { rows: [] }]]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/products/no-existe`);
  assert.equal(res.status, 404);
});

test('GET /products/:id: producto existente devuelve sus datos con "notes"', async (t) => {
  const { restore } = fakeDb([
    [Q.porId, { rows: [{ id: 'khamrah', name: 'Khamrah', salida: 'Canela', corazon: 'Dátil', fondo: 'Vainilla' }] }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/products/khamrah`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.id, 'khamrah');
  assert.deepEqual(body.notes, { salida: 'Canela', corazon: 'Dátil', fondo: 'Vainilla' });
});

// ── POST /products (crear) — validación ─────────────────────────────────────

test('POST /products: sin id responde 400 y no toca la base', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const { id, ...sinId } = PRODUCTO_VALIDO;
  const res = await pedir('POST', '/products', sinId);
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.match(body.message, /id/i);
  assert.equal(log.length, 0);
});

test('POST /products: id con caracteres inválidos (espacios, símbolos) responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, id: 'khamrah lattafa!' });
  assert.equal(res.status, 400);
});

test('POST /products: id con guiones intermedios sí es válido (control positivo del formato)', async (t) => {
  const { restore } = fakeDb([[Q.insertar, { rows: [], rowCount: 1 }]]);
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, id: 'lattafa-khamrah-90ml' });
  assert.equal(res.status, 201);
});

test('POST /products: sin nombre responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, name: '' });
  assert.equal(res.status, 400);
});

test('POST /products: nombre de más de 200 caracteres responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, name: 'A'.repeat(201) });
  assert.equal(res.status, 400);
});

test('POST /products: precio con más de 2 decimales responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, price: '390.999' });
  assert.equal(res.status, 400);
});

test('POST /products: precio negativo responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, price: '-10' });
  assert.equal(res.status, 400);
});

test('POST /products: precio no numérico responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, price: 'gratis' });
  assert.equal(res.status, 400);
});

test('POST /products: precio faltante responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const { price, ...sinPrecio } = PRODUCTO_VALIDO;
  const res = await pedir('POST', '/products', sinPrecio);
  assert.equal(res.status, 400);
});

test('POST /products: stock no entero responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, stock: '5.5' });
  assert.equal(res.status, 400);
});

test('POST /products: stock negativo responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, stock: -3 });
  assert.equal(res.status, 400);
});

test('POST /products: category_id no entero responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, category_id: 'dos' });
  assert.equal(res.status, 400);
});

test('POST /products: "notes" como arreglo (en vez de objeto) responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', { ...PRODUCTO_VALIDO, notes: ['Canela'] });
  assert.equal(res.status, 400);
});

// ── POST /products (crear) — camino feliz y errores de base ────────────────

test('POST /products: producto válido se crea y devuelve 201', async (t) => {
  const { log, restore } = fakeDb([[Q.insertar, { rows: [], rowCount: 1 }]]);
  t.after(restore);

  const res = await pedir('POST', '/products', PRODUCTO_VALIDO);
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.success, true);

  // Las notas se descomponen en salida/corazon/fondo al insertar.
  const insertParams = log[0].params;
  assert.deepEqual(insertParams, [
    'khamrah-lattafa', 'Khamrah', '390.00', undefined, undefined, 10,
    'Canela', 'Dátil', 'Vainilla', 2, null, null, null, null,
  ]);
});

test('POST /products: id duplicado (unique_violation) responde 500 sin filtrar el error interno', async (t) => {
  const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
  const { restore } = fakeDb([[Q.insertar, () => { throw duplicate; }]]);
  t.after(restore);

  const res = await pedir('POST', '/products', PRODUCTO_VALIDO);
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.equal(body.success, false);
});

// ── PUT /products/:id (actualizar) ──────────────────────────────────────────

test('PUT /products/:id: sin nombre responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/products/khamrah', { price: '390.00' });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.match(body.message, /nombre/i);
});

test('PUT /products/:id: precio inválido (no numérico) responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/products/khamrah', { name: 'Khamrah', price: 'gratis' });
  assert.equal(res.status, 400);
});

test('PUT /products/:id: precio negativo responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/products/khamrah', { name: 'Khamrah', price: -5 });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.match(body.message, /negativ/i);
});

test('PUT /products/:id: stock negativo responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/products/khamrah', { name: 'Khamrah', price: '390.00', stock: -1 });
  assert.equal(res.status, 400);
});

test('PUT /products/:id: producto inexistente responde 404', async (t) => {
  const { restore } = fakeDb([[Q.actualizar, { rows: [], rowCount: 0 }]]);
  t.after(restore);

  const res = await pedir('PUT', '/products/no-existe', { name: 'Khamrah', price: '390.00' });
  assert.equal(res.status, 404);
});

test('PUT /products/:id: actualización válida responde 200 y manda los parámetros correctos', async (t) => {
  const { log, restore } = fakeDb([[Q.actualizar, { rows: [], rowCount: 1 }]]);
  t.after(restore);

  const res = await pedir('PUT', '/products/khamrah-lattafa', {
    name: 'Khamrah Edición Especial',
    price: '410.00',
    stock: 8,
    notes: { salida: 'Canela', corazon: 'Dátil', fondo: 'Vainilla' },
    category_id: 2,
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);

  const params = log[0].params;
  assert.equal(params[0], 'Khamrah Edición Especial');
  assert.equal(params[1], '410.00');
  assert.equal(params[params.length - 1], 'khamrah-lattafa'); // WHERE id = $14
});

// ── DELETE /products/:id ─────────────────────────────────────────────────────

test('DELETE /products/:id: producto inexistente responde 404', async (t) => {
  const { restore } = fakeDb([[Q.borrar, { rows: [], rowCount: 0 }]]);
  t.after(restore);

  const res = await pedir('DELETE', '/products/no-existe');
  assert.equal(res.status, 404);
});

test('DELETE /products/:id: elimina el producto y responde 200', async (t) => {
  const { log, restore } = fakeDb([[Q.borrar, { rows: [], rowCount: 1 }]]);
  t.after(restore);

  const res = await pedir('DELETE', '/products/khamrah-lattafa');
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(log[0].params, ['khamrah-lattafa']);
});

test('DELETE /products/:id: error de base de datos responde 500', async (t) => {
  const { restore } = fakeDb([[Q.borrar, () => { throw new Error('fallo de conexión'); }]]);
  t.after(restore);

  const res = await pedir('DELETE', '/products/khamrah-lattafa');
  assert.equal(res.status, 500);
});