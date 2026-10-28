// SFTWRKEY-411: verificaciones de seguridad pendientes del Sprint 8.
// SEC-05: un CLIENTE no usa ninguna ruta de admin. SEC-36: login con Google.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';
process.env.GOOGLE_CLIENT_ID = 'cliente-de-prueba.apps.googleusercontent.com';

const { OAuth2Client } = await import('google-auth-library');
const { default: bcrypt } = await import('bcryptjs');
const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { default: app } = await import('./server.js');

const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';
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

// ── SEC-05: todas las rutas de admin con un token de CLIENTE ────────────────

const RUTAS_ADMIN = [
  ['GET', '/admin/orders'], ['GET', '/admin/orders/1'], ['PATCH', '/admin/orders/1/status'],
  ['GET', '/admin/perfum-sync-logs'], ['GET', '/admin/security-alerts'],
  ['GET', '/admin/alerts'], ['POST', '/admin/alerts/read'], ['POST', '/admin/product-images'],
  ['GET', '/report'], ['GET', '/report/metrics'], ['GET', '/report/sales-monthly'],
  ['GET', '/report/sales-by-category'], ['GET', '/report/top-products'], ['GET', '/report/inventory'],
  ['GET', '/imports/products'], ['GET', '/imports/products/template'], ['POST', '/imports/products'],
  ['GET', '/external-perfumes/search?q=oud'], ['GET', '/external-perfumes/brands'],
  ['GET', '/users/search?q=ana'],
  ['POST', '/products'], ['PUT', '/products/khamrah'], ['DELETE', '/products/khamrah'],
];

test('SEC-05: con un token de CLIENTE todas las rutas /admin*, /report*, /imports* y /external-perfumes* responden 403', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);
  const token = signToken({ id: 7, role: 'CLIENTE' });

  for (const [method, ruta] of RUTAS_ADMIN) {
    const res = await fetch(`${baseUrl}${ruta}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Origin: ORIGIN },
      body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({ status: 'enviado', ids: ['1'] }),
    });
    assert.equal(res.status, 403, `${method} ${ruta}`);
  }
  // solo se pudo ejecutar la preparación de tablas de commerce.js, ninguna consulta de datos
  assert.equal(log.filter((e) => /FROM (orders|products|users|report|product_imports|security_events)\b/i.test(e.sql)).length, 0);
});

// ── SEC-36: login con Google ────────────────────────────────────────────────

const original = OAuth2Client.prototype.verifyIdToken;
const googleResponde = (t, payload) => {
  OAuth2Client.prototype.verifyIdToken = async () => {
    if (payload instanceof Error) throw payload;
    return { getPayload: () => payload };
  };
  t.after(() => { OAuth2Client.prototype.verifyIdToken = original; });
};
const PAYLOAD = { sub: 'google-123', email: 'nuevo@gmail.com', email_verified: true, nonce: 'nonce-1', name: 'Nuevo', exp: 9999999999 };

let ip = 10;
const loginGoogle = (body = { credential: 'token-de-google', nonce: 'nonce-1' }) =>
  fetch(`${baseUrl}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Forwarded-For': `198.51.100.${ip++}` },
    body: JSON.stringify(body),
  });

const tokenNuevo = [/INSERT INTO google_used_tokens/i, { rows: [{ token_hash: 'x' }] }];

test('SEC-36: un token de Google inválido responde 401', async (t) => {
  googleResponde(t, new Error('firma inválida'));
  const { restore } = fakeDb([tokenNuevo]);
  t.after(restore);
  assert.equal((await loginGoogle()).status, 401);
});

test('SEC-36: un correo no verificado por Google responde 401', async (t) => {
  googleResponde(t, { ...PAYLOAD, email_verified: false });
  const { log, restore } = fakeDb([tokenNuevo]);
  t.after(restore);
  assert.equal((await loginGoogle()).status, 401);
  assert.equal(log.some((e) => /INSERT INTO users/i.test(e.sql)), false);
});

test('SEC-36: un nonce que no coincide responde 401', async (t) => {
  googleResponde(t, PAYLOAD);
  const { restore } = fakeDb([tokenNuevo]);
  t.after(restore);
  assert.equal((await loginGoogle({ credential: 'token-de-google', nonce: 'otro-nonce' })).status, 401);
});

test('SEC-36: un token de Google ya usado responde 401', async (t) => {
  googleResponde(t, PAYLOAD);
  const { log, restore } = fakeDb([[/INSERT INTO google_used_tokens/i, { rows: [] }]]);
  t.after(restore);
  assert.equal((await loginGoogle()).status, 401);
  assert.equal(log.some((e) => /INSERT INTO users/i.test(e.sql)), false);
});

test('SEC-36: un correo que ya tiene cuenta con contraseña responde 409 y no se vincula solo', async (t) => {
  googleResponde(t, { ...PAYLOAD, email: 'maria@luxor.com' });
  const { log, restore } = fakeDb([
    tokenNuevo,
    [/FROM google_accounts g/i, { rows: [] }],
    [/SELECT id FROM users WHERE LOWER\(email\)=\$1/i, { rows: [{ id: 3 }] }],
  ]);
  t.after(restore);
  assert.equal((await loginGoogle()).status, 409);
  assert.equal(log.some((e) => /INSERT INTO google_accounts/i.test(e.sql)), false);
});

test('SEC-36: una cuenta creada con Google no entra por /login con una contraseña adivinada', async (t) => {
  // commerce.js le pone a la cuenta una contraseña aleatoria de 96 caracteres
  const hash = await bcrypt.hash('a'.repeat(96), 4);
  const { restore } = fakeDb([[/FROM users u JOIN rol r/i, { rows: [{ id: 9, name: 'Nuevo', email: 'nuevo@gmail.com', password_hash: hash, role: 'CLIENTE' }] }]]);
  t.after(restore);

  for (const password of ['', '123456', 'password', 'nuevo@gmail.com']) {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${ip++}` },
      body: JSON.stringify({ email: 'nuevo@gmail.com', password }),
    });
    assert.ok([400, 401].includes(res.status), `contraseña "${password}": ${res.status}`);
  }
});
