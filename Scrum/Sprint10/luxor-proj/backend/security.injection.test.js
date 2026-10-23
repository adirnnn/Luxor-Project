// SFTWRKEY-379: pruebas de inyección (OWASP A05): SQL, XSS almacenado y validación de imagen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { isSafeImage } = await import('./services/imageValidation.js');
const { validateCsv, CSV_COLUMNS } = await import('./csvImport.js');
const { default: app } = await import('./server.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Doble del pool de PostgreSQL (mismo patrón que authorization.test.js).
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

const pedir = (metodo, ruta, { token, body } = {}) =>
  fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const adminToken = signToken({ id: 1, role: 'ADMIN' });

const PAYLOADS_SQL = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  '" OR 1=1 --',
  "admin@luxor.com'--",
  "%' UNION SELECT id, email, password FROM users --",
  '1; SELECT pg_sleep(5)',
];

// Verifica que el payload viajó como parámetro ($n) y nunca dentro del texto SQL.
function assertParametrizado(log, payload) {
  assert.ok(log.length > 0, 'debe ejecutarse al menos una consulta');
  for (const { sql } of log) {
    assert.ok(!sql.includes(payload), `el payload no debe aparecer en el SQL: ${sql}`);
  }
  assert.ok(
    log.some(({ params = [] }) => params.some((p) => String(p).includes(payload))),
    'el payload debe llegar como parámetro de la consulta',
  );
}

// ── Inyección SQL ───────────────────────────────────────────────────────────

for (const payload of PAYLOADS_SQL) {
  test(`A05 SQL: /products/search parametriza ${JSON.stringify(payload)}`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir('GET', `/products/search?busqueda=${encodeURIComponent(payload)}`);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).products ?? [], []);
    assertParametrizado(log, payload);
  });

  test(`A05 SQL: /login parametriza ${JSON.stringify(payload)}`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir('POST', '/login', { body: { email: payload, password: payload } });
    assert.equal(res.status, 401);
    assertParametrizado(log, payload);
  });

  test(`A05 SQL: /users/search parametriza ${JSON.stringify(payload)}`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir('GET', `/users/search?q=${encodeURIComponent(payload)}`, { token: adminToken });
    assert.equal(res.status, 200);
    assertParametrizado(log, payload);
  });

  test(`A05 SQL: /products/:id parametriza ${JSON.stringify(payload)}`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir('GET', `/products/${encodeURIComponent(payload)}`);
    assert.equal(res.status, 404);
    assertParametrizado(log, payload);
  });
}

// ── XSS almacenado: el backend guarda el texto tal cual, como parámetro ──────
// (React lo escapa al renderizar; ver src/test/xss.test.tsx)

test('A05 XSS: un nombre con <script> se guarda como parámetro, sin alterar el SQL', async (t) => {
  const { log, restore } = fakeDb([[/INSERT INTO products/i, { rows: [], rowCount: 1 }]]);
  t.after(restore);

  const nombre = "<script>alert('xss')</script>";
  const res = await pedir('POST', '/products', {
    token: adminToken,
    body: { id: 'xss-test', name: nombre, price: '10', description: '<img src=x onerror=alert(1)>' },
  });
  assert.equal(res.status, 201);
  assertParametrizado(log, nombre);
});

// ── Validación del campo image ──────────────────────────────────────────────

const IMAGENES_INVALIDAS = [
  'javascript:alert(1)',
  'JAVASCRIPT:alert(1)',
  'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
  'http://sitio.com/foto.jpg',
  '//evil.com/foto.jpg',
  '/\\evil.com/foto.jpg',
  ' /images/con-espacio.png',
  'images/sin-barra.png',
  'ftp://sitio.com/foto.jpg',
  `https://sitio.com/${'a'.repeat(500)}`,
];

const IMAGENES_VALIDAS = [
  '',
  null,
  undefined,
  '/images/lattafaKhamrah.png',
  '/assets/products/cdnIntense.png',
  'https://fimgs.net/mdimg/perfume-thumbs/375x500.49912.jpg',
];

test('isSafeImage: rechaza protocolos peligrosos, http, rutas relativas y "//host"', () => {
  for (const imagen of IMAGENES_INVALIDAS) {
    assert.equal(isSafeImage(imagen), false, `debe rechazar ${JSON.stringify(imagen)}`);
  }
});

test('isSafeImage: acepta vacío, rutas locales y URLs https', () => {
  for (const imagen of IMAGENES_VALIDAS) {
    assert.equal(isSafeImage(imagen), true, `debe aceptar ${JSON.stringify(imagen)}`);
  }
});

test('A05: POST /products rechaza una imagen javascript: (400 sin tocar la base)', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/products', {
    token: adminToken,
    body: { id: 'img-test', name: 'Test', price: '10', image: 'javascript:alert(1)' },
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /imagen/i);
  assert.equal(log.length, 0);
});

test('A05: PUT /products/:id rechaza una imagen http: (400 sin tocar la base)', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/products/khamrah', {
    token: adminToken,
    body: { name: 'Khamrah', price: '390.00', image: 'http://sitio.com/foto.jpg' },
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /imagen/i);
  assert.equal(log.length, 0);
});

test('A05: POST /products acepta una imagen https', async (t) => {
  const { restore } = fakeDb([[/INSERT INTO products/i, { rows: [], rowCount: 1 }]]);
  t.after(restore);

  const res = await pedir('POST', '/products', {
    token: adminToken,
    body: { id: 'img-ok', name: 'Test', price: '10', image: 'https://fimgs.net/foto.jpg' },
  });
  assert.equal(res.status, 201);
});

test('A05: la importación CSV marca como error una fila con imagen javascript:', () => {
  const fila = ['xss-csv', 'Perfume', '100.00', 'javascript:alert(1)', 'desc', '5', 'a', 'b', 'c'];
  const { errors } = validateCsv(`${CSV_COLUMNS.join(',')}\n${fila.join(',')}\n`);
  assert.ok(errors.some((e) => e.field === 'image' && e.row === 2));
});

// ── PUT /products/:id usa la misma validación que el POST ───────────────────

test('A05: PUT /products/:id rechaza stock no numérico', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/products/khamrah', {
    token: adminToken,
    body: { name: 'Khamrah', price: '390.00', stock: 'abc' },
  });
  assert.equal(res.status, 400);
  assert.equal(log.length, 0);
});

test('A05: PUT /products/:id rechaza un nombre de más de 200 caracteres', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/products/khamrah', {
    token: adminToken,
    body: { name: 'a'.repeat(201), price: '390.00' },
  });
  assert.equal(res.status, 400);
  assert.equal(log.length, 0);
});
