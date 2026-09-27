// SFTWRKEY-378: pruebas de control de acceso (OWASP A01).
// Complementa authorization.test.js: aquí van los casos que ese archivo no cubre
// (rutas de admin restantes, tokens manipulados, otros roles, IDs alterados y
// escalamiento de privilegios por el body).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';

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

const pedir = (metodo, ruta, { token, body, headers } = {}) =>
  fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const clienteToken = signToken({ id: 7, role: 'CLIENTE' });
const vendedorToken = signToken({ id: 8, role: 'VENDEDOR' });

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

// ── Rutas de admin que authorization.test.js no prueba con rol CLIENTE ──────

const RUTAS_SOLO_ADMIN_FALTANTES = [
  ['GET', '/report/sales-monthly'],
  ['GET', '/report/sales-by-category'],
  ['GET', '/report/top-products'],
  ['GET', '/report/inventory'],
  ['GET', '/imports/products/template'],
  ['POST', '/imports/products', { fileName: 'a.csv', csv: 'id,name\n' }],
];

for (const [metodo, ruta, body] of RUTAS_SOLO_ADMIN_FALTANTES) {
  test(`A01: un CLIENTE no puede ${metodo} ${ruta} (403 sin tocar la base)`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir(metodo, ruta, { token: clienteToken, body });
    assert.equal(res.status, 403);
    assert.equal(log.length, 0);
  });
}

test('A01: GET /imports/products/template sin token responde 401', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('GET', '/imports/products/template');
  assert.equal(res.status, 401);
  assert.equal(log.length, 0);
});

// ── Otros roles: VENDEDOR no tiene permisos de ADMIN ────────────────────────

const RUTAS_ADMIN_MUESTRA = [
  ['POST', '/products', { id: 'p1', name: 'Test', price: '10' }],
  ['DELETE', '/products/p1'],
  ['GET', '/report/metrics'],
  ['GET', '/users/search?q=ana'],
  ['POST', '/imports/products', { fileName: 'a.csv', csv: 'id,name\n' }],
];

for (const [metodo, ruta, body] of RUTAS_ADMIN_MUESTRA) {
  test(`A01: un VENDEDOR no puede ${metodo} ${ruta} (403)`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir(metodo, ruta, { token: vendedorToken, body });
    assert.equal(res.status, 403);
    assert.equal(log.length, 0);
  });
}

test('A01: un VENDEDOR no puede ver el perfil ni el carrito de un cliente (403)', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  assert.equal((await pedir('GET', '/user/7', { token: vendedorToken })).status, 403);
  assert.equal((await pedir('GET', '/cart/7', { token: vendedorToken })).status, 403);
  assert.equal(log.length, 0);
});

// ── Tokens manipulados ──────────────────────────────────────────────────────

test('A01: token sin firma (alg "none") que dice ser ADMIN responde 401', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const sinFirma = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ id: 1, role: 'ADMIN' })}.`;
  const res = await pedir('GET', '/report', { token: sinFirma });
  assert.equal(res.status, 401);
  assert.equal(log.length, 0);
});

test('A01: cambiar el rol en el payload de un token válido invalida la firma (401)', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const [header, , firma] = clienteToken.split('.');
  const payloadAdmin = base64url({ id: 7, role: 'ADMIN', iat: Math.floor(Date.now() / 1000) });
  const res = await pedir('GET', '/report', { token: `${header}.${payloadAdmin}.${firma}` });
  assert.equal(res.status, 401);
  assert.equal(log.length, 0);
});

test('A01: esquemas de autorización distintos de Bearer responden 401', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const variantes = [`Basic ${clienteToken}`, 'Bearer', 'Bearer ', `Token ${clienteToken}`];
  for (const valor of variantes) {
    const res = await pedir('GET', '/user/7', { headers: { Authorization: valor } });
    assert.equal(res.status, 401, `Authorization: "${valor}"`);
  }
  assert.equal(log.length, 0);
});

test('A01: token válido sin id no da acceso a recursos de un usuario (403)', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const sinId = jwt.sign({ role: 'CLIENTE' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await pedir('GET', '/user/7', { token: sinId })).status, 403);
  assert.equal((await pedir('GET', '/user/undefined', { token: sinId })).status, 403);
  assert.equal(log.length, 0);
});

test('A01: token válido sin rol no da acceso a rutas de admin (403)', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const sinRol = jwt.sign({ id: 7 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await pedir('GET', '/report', { token: sinRol })).status, 403);
  assert.equal(log.length, 0);
});

// ── IDs alterados en la URL (el cliente 7 intenta variantes de otro id) ─────

for (const ruta of ['/user/07', '/user/7abc', '/user/%207', '/cart/7.0', '/cart/-7', '/user/7%20OR%201=1']) {
  test(`A01: el CLIENTE 7 recibe 403 con el id alterado ${ruta}`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir('GET', ruta, { token: clienteToken });
    assert.equal(res.status, 403);
    assert.equal(log.length, 0);
  });
}

// ── Escalamiento de privilegios por el body (mass assignment) ───────────────

test('A01: PUT /user/:id ignora un "role" enviado en el body', async (t) => {
  const { log, restore } = fakeDb([
    [/UPDATE users SET/i, { rows: [{ id: 7, name: 'Ana', email: 'ana@test.com' }] }],
  ]);
  t.after(restore);

  const res = await pedir('PUT', '/user/7', {
    token: clienteToken,
    body: { name: 'Ana', email: 'ana@test.com', role: 'ADMIN', id: 1 },
  });
  assert.equal(res.status, 200);

  const update = log.find((q) => /UPDATE users SET/i.test(q.sql));
  assert.ok(update, 'debe ejecutarse el UPDATE');
  assert.doesNotMatch(update.sql, /\brole\b/i, 'el UPDATE no debe tocar la columna role');
  assert.deepEqual(update.params, ['Ana', 'ana@test.com', '7'], 'el id sale de la URL autorizada, no del body');
});

test('A01: POST /register siempre crea CLIENTE aunque el body pida otro rol', async (t) => {
  const { log, restore } = fakeDb([
    [/INSERT INTO users/i, { rows: [{ id: 50, name: 'Eve', email: 'eve@test.com' }] }],
  ]);
  t.after(restore);

  const res = await pedir('POST', '/register', {
    body: { name: 'Eve', email: 'eve@test.com', password: 'clave123', role: 1 },
  });
  const payload = await res.json();
  assert.equal(res.status, 201);
  assert.equal(payload.user.role, 'CLIENTE');

  const insert = log.find((q) => /INSERT INTO users/i.test(q.sql));
  assert.match(insert.sql, /VALUES \(\$1, \$2, \$3, 3\)/, 'el rol 3 (CLIENTE) está fijo en el SQL');
  assert.equal(insert.params.length, 3);
});
