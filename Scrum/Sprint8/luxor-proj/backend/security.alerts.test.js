// SFTWRKEY-401: pruebas de alertas de seguridad
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { rateLimit } = await import('./services/rateLimit.js');
const { default: app } = await import('./server.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// pool falso, igual que en security.config.test.js
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

const eventos = (log) =>
  log.filter((entry) => /^INSERT INTO security_events/i.test(entry.sql)).map((entry) => entry.params);

const login = (ip, email = 'Victima@Test.com', password = 'incorrecta') =>
  fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ email, password }),
  });

const alertas = (token) =>
  fetch(`${baseUrl}/admin/security-alerts`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

// ── Registro de eventos ─────────────────────────────────────────────────────

test('A09: 10 logins fallidos quedan registrados como LOGIN_FAILED con IP y correo', async (t) => {
  const { log, restore } = fakeDb([[/FROM users u JOIN rol r/i, { rows: [] }]]);
  t.after(restore);

  for (let i = 0; i < 10; i += 1) {
    const res = await login('203.0.113.50');
    assert.equal(res.status, 401);
  }

  const registrados = eventos(log);
  assert.equal(registrados.length, 10);
  for (const [type, ip, email, path] of registrados) {
    assert.equal(type, 'LOGIN_FAILED');
    assert.equal(ip, '203.0.113.50');
    assert.equal(email, 'victima@test.com', 'el correo se guarda en minúsculas');
    assert.equal(path, '/login');
  }
});

test('A09: la contraseña nunca se guarda en el evento', async (t) => {
  const { log, restore } = fakeDb([[/FROM users u JOIN rol r/i, { rows: [] }]]);
  t.after(restore);

  await login('203.0.113.51', 'otra@test.com', 'MiClaveSecreta#123');
  assert.equal(eventos(log).length, 1);
  assert.ok(!JSON.stringify(log).includes('MiClaveSecreta#123'));
});

test('A09: el bloqueo del rate limit se registra una sola vez por ventana', async (t) => {
  const { log, restore } = fakeDb([[/FROM users u JOIN rol r/i, { rows: [] }]]);
  t.after(restore);

  let res;
  for (let i = 0; i < 13; i += 1) res = await login('203.0.113.52');
  assert.equal(res.status, 429);

  const tipos = eventos(log).map(([type]) => type);
  assert.equal(tipos.filter((type) => type === 'LOGIN_FAILED').length, 10);
  assert.equal(tipos.filter((type) => type === 'RATE_LIMITED').length, 1);
});

test('A09: un login correcto no genera eventos', async (t) => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash('correcta', 4);
  const { log, restore } = fakeDb([[/FROM users u JOIN rol r/i, {
    rows: [{ id: 1, name: 'Ana', email: 'ana@test.com', password_hash: hash, role: 'CLIENTE' }],
  }]]);
  t.after(restore);

  const res = await login('203.0.113.53', 'ana@test.com', 'correcta');
  assert.equal(res.status, 200);
  assert.equal(eventos(log).length, 0);
});

test('A09: si falla el registro del evento, el login responde igual (401)', async (t) => {
  const { restore } = fakeDb([
    [/FROM users u JOIN rol r/i, { rows: [] }],
    [/security_events/i, () => { throw new Error('BD caída'); }],
  ]);
  t.after(restore);
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });

  const res = await login('203.0.113.54');
  assert.equal(res.status, 401);
});

test('rateLimit: onBlock se llama una vez por ventana', () => {
  const bloqueos = [];
  const limiter = rateLimit({ windowMs: 60_000, max: 2, onBlock: (req) => bloqueos.push(req.ip) });
  const req = { ip: '192.0.2.99', path: '/login' };
  const res = { status() { return this; }, json() { return this; } };

  for (let i = 0; i < 5; i += 1) limiter(req, res, () => {});
  assert.deepEqual(bloqueos, ['192.0.2.99']);
});

// ── GET /admin/security-alerts ──────────────────────────────────────────────

test('A09: GET /admin/security-alerts exige autenticación y rol ADMIN', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  assert.equal((await alertas()).status, 401);
  assert.equal((await alertas(signToken({ id: 7, role: 'CLIENTE' }))).status, 403);
  assert.equal((await alertas(signToken({ id: 8, role: 'VENDEDOR' }))).status, 403);
  assert.equal(log.length, 0);
});

test('A09: el ADMIN recibe alertas por IP y por cuenta con umbral 10 en 15 minutos', async (t) => {
  const lastAt = '2026-09-29T10:00:00.000Z';
  const { log, restore } = fakeDb([
    [/GROUP BY ip/i, { rows: [{ ip: '203.0.113.50', attempts: 10, last_at: lastAt }] }],
    [/GROUP BY email/i, { rows: [{ email: 'admin@test.com', attempts: 14, last_at: lastAt }] }],
    [/FROM security_events WHERE created_at/i, {
      rows: [{ id: '1', type: 'RATE_LIMITED', ip: '203.0.113.50', email: null, path: '/login', created_at: lastAt }],
    }],
  ]);
  t.after(restore);

  const res = await alertas(signToken({ id: 1, role: 'ADMIN' }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');

  const body = await res.json();
  assert.equal(body.threshold, 10);
  assert.equal(body.windowMinutes, 15);
  assert.deepEqual(body.alerts, [
    { kind: 'ip', target: '203.0.113.50', attempts: 10, last_at: lastAt },
    { kind: 'account', target: 'admin@test.com', attempts: 14, last_at: lastAt },
  ]);
  assert.equal(body.recent.length, 1);

  const porIp = log.find((entry) => /GROUP BY ip/i.test(entry.sql));
  assert.deepEqual(porIp.params, ['LOGIN_FAILED', 15, 10]);
});

test('A09: un error de la BD en las alertas responde 500 genérico', async (t) => {
  const { restore } = fakeDb([[/GROUP BY ip/i, () => { throw new Error('detalle interno de postgres'); }]]);
  t.after(restore);
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });

  const res = await alertas(signToken({ id: 1, role: 'ADMIN' }));
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.ok(!JSON.stringify(body).includes('postgres'));
});
