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

// Doble del pool de PostgreSQL: por defecto no debería necesitarse en la
// mayoría de estos casos, porque la autenticación/autorización debe cortar
// la petición ANTES de tocar la base.
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

const clienteToken = signToken({ id: 7, role: 'CLIENTE' });
const adminToken = signToken({ id: 1, role: 'ADMIN' });

// ── Endpoints protegidos: sin token, todos responden 401 ──────────────────

const RUTAS_PROTEGIDAS = [
  ['POST', '/products', { id: 'p1', name: 'Test', price: '10' }],
  ['PUT', '/products/p1', { name: 'Test', price: '10' }],
  ['DELETE', '/products/p1'],
  ['GET', '/external-perfumes/search?q=oud'],
  ['GET', '/external-perfumes/brands'],
  ['GET', '/admin/perfum-sync-logs'],
  ['GET', '/imports/products'],
  ['POST', '/imports/products', { fileName: 'a.csv', csv: '' }],
  ['GET', '/user/7'],
  ['GET', '/user/7/orders'],
  ['PUT', '/user/7', { name: 'A', email: 'a@a.com' }],
  ['PUT', '/user/7/password', { currentPassword: 'a', newPassword: 'bbbbbb' }],
  ['GET', '/users/search?q=ana'],
  ['GET', '/cart/7'],
  ['POST', '/cart/7', []],
  ['POST', '/checkout/7', {}],
  ['GET', '/report'],
  ['GET', '/report/metrics'],
  ['GET', '/report/sales-monthly'],
  ['GET', '/report/sales-by-category'],
  ['GET', '/report/top-products'],
  ['GET', '/report/inventory'],
];

for (const [metodo, ruta, body] of RUTAS_PROTEGIDAS) {
  test(`sin token: ${metodo} ${ruta} responde 401 y no toca la base`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir(metodo, ruta, { body });
    const payload = await res.json();

    assert.equal(res.status, 401);
    assert.equal(payload.success, false);
    assert.equal(log.length, 0, 'no debe ejecutarse ninguna consulta antes de autenticar');
  });
}

// ── Tokens inválidos / mal formados ────────────────────────────────────────

test('token con formato inválido (sin "Bearer") responde 401', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await fetch(`${baseUrl}/user/7`, { headers: { Authorization: clienteToken } });
  assert.equal(res.status, 401);
});

test('token corrupto/alterado responde 401', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const alterado = clienteToken.slice(0, -2) + 'xx';
  const res = await pedir('GET', '/user/7', { token: alterado });
  assert.equal(res.status, 401);
});

test('token firmado con otra clave secreta se rechaza (no confía en el payload por sí solo)', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const tokenFalso = jwt.sign({ id: 1, role: 'ADMIN' }, 'otra-clave-distinta', { expiresIn: '1h' });
  const res = await pedir('GET', '/user/7', { token: tokenFalso });
  assert.equal(res.status, 401);
});

test('token expirado responde 401', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const expirado = jwt.sign({ id: 7, role: 'CLIENTE' }, process.env.JWT_SECRET, { expiresIn: -10 });
  const res = await pedir('GET', '/user/7', { token: expirado });
  assert.equal(res.status, 401);
});

// ── Autorización por rol (requireRoles: solo ADMIN) ────────────────────────

const RUTAS_SOLO_ADMIN = [
  ['POST', '/products', { id: 'p1', name: 'Test', price: '10' }],
  ['PUT', '/products/p1', { name: 'Test', price: '10' }],
  ['DELETE', '/products/p1'],
  ['GET', '/external-perfumes/search?q=oud'],
  ['GET', '/external-perfumes/brands'],
  ['GET', '/admin/perfum-sync-logs'],
  ['GET', '/imports/products'],
  ['GET', '/users/search?q=ana'],
  ['GET', '/report'],
  ['GET', '/report/metrics'],
];

for (const [metodo, ruta, body] of RUTAS_SOLO_ADMIN) {
  test(`un CLIENTE no puede: ${metodo} ${ruta} (responde 403)`, async (t) => {
    const { log, restore } = fakeDb();
    t.after(restore);

    const res = await pedir(metodo, ruta, { token: clienteToken, body });
    const payload = await res.json();

    assert.equal(res.status, 403);
    assert.equal(payload.success, false);
    assert.equal(log.length, 0, 'no debe ejecutarse ninguna consulta si el rol no alcanza');
  });
}

// ── Autorización propia o rol (authorizeSelfOrRoles): IDOR ─────────────────

test('un CLIENTE no puede ver el perfil de otro usuario (IDOR en /user/:userId)', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('GET', '/user/999', { token: clienteToken });
  assert.equal(res.status, 403);
  assert.equal(log.length, 0);
});

test('un CLIENTE sí puede ver su propio perfil', async (t) => {
  const { restore } = fakeDb([
    [/FROM users u JOIN rol r/i, { rows: [{ id: 7, name: 'Ana', email: 'ana@luxor.com', role: 'CLIENTE' }] }],
  ]);
  t.after(restore);

  const res = await pedir('GET', '/user/7', { token: clienteToken });
  assert.equal(res.status, 200);
});

test('un CLIENTE no puede ver el historial de pedidos de otro usuario', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('GET', '/user/999/orders', { token: clienteToken });
  assert.equal(res.status, 403);
  assert.equal(log.length, 0);
});

test('un CLIENTE no puede editar el perfil de otro usuario', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/user/999', { token: clienteToken, body: { name: 'Hackeo', email: 'x@x.com' } });
  assert.equal(res.status, 403);
  assert.equal(log.length, 0);
});

test('un CLIENTE no puede cambiar la contraseña de otro usuario', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('PUT', '/user/999/password', {
    token: clienteToken,
    body: { currentPassword: 'a', newPassword: 'bbbbbb' },
  });
  assert.equal(res.status, 403);
  assert.equal(log.length, 0);
});

test('un CLIENTE no puede ver ni modificar el carrito de otro usuario', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const get = await pedir('GET', '/cart/999', { token: clienteToken });
  assert.equal(get.status, 403);

  const post = await pedir('POST', '/cart/999', { token: clienteToken, body: [] });
  assert.equal(post.status, 403);

  assert.equal(log.length, 0);
});

test('un CLIENTE no puede hacer checkout a nombre de otro usuario', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/checkout/999', { token: clienteToken, body: {} });
  assert.equal(res.status, 403);
  assert.equal(log.length, 0);
});

test('un ADMIN sí puede acceder al perfil, pedidos y carrito de cualquier usuario', async (t) => {
  const { restore } = fakeDb([
    [/FROM users u JOIN rol r/i, { rows: [{ id: 999, name: 'Otro', email: 'otro@luxor.com', role: 'CLIENTE' }] }],
    [/FROM orders/i, { rows: [] }],
    [/FROM carts WHERE user_id/i, { rows: [] }],
  ]);
  t.after(restore);

  const perfil = await pedir('GET', '/user/999', { token: adminToken });
  assert.equal(perfil.status, 200);

  const pedidos = await pedir('GET', '/user/999/orders', { token: adminToken });
  assert.equal(pedidos.status, 200);

  const carrito = await pedir('GET', '/cart/999', { token: adminToken });
  assert.equal(carrito.status, 200);
});

// ── CRUD de productos exige rol ADMIN, aunque el CLIENTE esté autenticado ──

test('un ADMIN autenticado sí puede crear productos (control positivo)', async (t) => {
  const { restore } = fakeDb([
    [/INSERT INTO products/i, { rows: [], rowCount: 1 }],
  ]);
  t.after(restore);

  const res = await pedir('POST', '/products', {
    token: adminToken,
    body: { id: 'nuevo-perfume', name: 'Nuevo', price: '199.99', stock: 5 },
  });
  assert.equal(res.status, 201);
});

// ── Rate limiting en /login: fuerza bruta ──────────────────────────────────

test('rate limit en /login: bloquea con 429 tras superar el máximo de intentos por minuto', async (t) => {
  const { restore } = fakeDb([[/FROM users u JOIN rol r/i, { rows: [] }]]); // credenciales siempre incorrectas
  t.after(restore);

  let ultimaRespuesta;
  for (let i = 0; i < 11; i += 1) {
    ultimaRespuesta = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ataque@test.com', password: `intento-${i}` }),
    });
  }

  assert.equal(ultimaRespuesta.status, 429);
});

// ── Rutas públicas no deben exigir autenticación ───────────────────────────

test('rutas públicas (catálogo) no exigen token', async (t) => {
  const { restore } = fakeDb([
    [/FROM products p/i, { rows: [] }],
    [/FROM categories/i, { rows: [] }],
  ]);
  t.after(restore);

  const productos = await fetch(`${baseUrl}/products`);
  assert.equal(productos.status, 200);

  const categorias = await fetch(`${baseUrl}/categories`);
  assert.equal(categorias.status, 200);
});