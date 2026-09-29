// SFTWRKEY-380: configuración de seguridad (OWASP A02 y A10): cabeceras, trust proxy,
// clave interna del chatbot, errores sin información interna.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';
process.env.CHATBOT_INTERNAL_KEY = 'clave-interna-de-prueba';

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

const registrarConsulta = (headers = {}) =>
  fetch(`${baseUrl}/chatbot/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query: '¿Tienen Khamrah?', response: 'Sí.' }),
  });

// ── Cabeceras de seguridad (helmet) ─────────────────────────────────────────

test('A02: las respuestas incluyen cabeceras de seguridad y no exponen X-Powered-By', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await fetch(`${baseUrl}/products`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=\d+/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('x-frame-options'), 'debe incluir X-Frame-Options');
  assert.ok(res.headers.get('content-security-policy'), 'debe incluir Content-Security-Policy');
  assert.equal(res.headers.get('x-powered-by'), null);
});

// ── trust proxy: el rate limit distingue la IP real de cada cliente ─────────

test('A02: con trust proxy, el rate limit bloquea solo la IP que abusa', async (t) => {
  const { restore } = fakeDb([[/FROM users u JOIN rol r/i, { rows: [] }]]);
  t.after(restore);

  const login = (ip) =>
    fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ email: 'ataque@test.com', password: 'incorrecta' }),
    });

  let atacante;
  for (let i = 0; i < 11; i += 1) atacante = await login('203.0.113.10');
  assert.equal(atacante.status, 429, 'la IP que abusa queda bloqueada');

  const otroUsuario = await login('198.51.100.20');
  assert.equal(otroUsuario.status, 401, 'otra IP sigue pudiendo intentar el login');
});

// ── POST /chatbot/queries exige la clave interna ────────────────────────────

test('A02: POST /chatbot/queries sin X-Internal-Key responde 401 y no escribe en la base', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await registrarConsulta();
  assert.equal(res.status, 401);
  assert.equal(log.length, 0);
});

test('A02: POST /chatbot/queries con una clave incorrecta responde 401', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  for (const clave of ['incorrecta', 'clave-interna-de-prueba-extra', 'CLAVE-INTERNA-DE-PRUEBA']) {
    const res = await registrarConsulta({ 'X-Internal-Key': clave });
    assert.equal(res.status, 401, `clave "${clave}"`);
  }
  assert.equal(log.length, 0);
});

test('A02: un token de ADMIN no sustituye a la clave interna', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await registrarConsulta({ Authorization: `Bearer ${signToken({ id: 1, role: 'ADMIN' })}` });
  assert.equal(res.status, 401);
  assert.equal(log.length, 0);
});

test('A02: POST /chatbot/queries con la clave correcta responde 201', async (t) => {
  const { restore } = fakeDb([
    [/INSERT INTO chatbot_queries/i, { rows: [{ id: 1, query: '¿Tienen Khamrah?', response: 'Sí.', created_at: '2026-01-01' }] }],
  ]);
  t.after(restore);

  const res = await registrarConsulta({ 'X-Internal-Key': 'clave-interna-de-prueba' });
  assert.equal(res.status, 201);
});

test('A02: sin CHATBOT_INTERNAL_KEY configurada, el endpoint rechaza todo (falla cerrado)', async (t) => {
  const { log, restore } = fakeDb();
  const original = process.env.CHATBOT_INTERNAL_KEY;
  delete process.env.CHATBOT_INTERNAL_KEY;
  t.after(() => { process.env.CHATBOT_INTERNAL_KEY = original; restore(); });

  assert.equal((await registrarConsulta()).status, 401);
  assert.equal((await registrarConsulta({ 'X-Internal-Key': '' })).status, 401);
  assert.equal(log.length, 0);
});

// ── Errores sin información interna (A10) ───────────────────────────────────

test('A10: un JSON malformado responde 400 genérico, sin stack trace', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "a@a.com", "password": ',
  });
  const texto = await res.text();
  assert.equal(res.status, 400);
  assert.equal(JSON.parse(texto).success, false);
  assert.doesNotMatch(texto, /at .*\.js|SyntaxError|node_modules/);
});

test('A10: un body demasiado grande responde 413 genérico', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@a.com', password: 'x'.repeat(3 * 1024 * 1024) }),
  });
  const texto = await res.text();
  assert.equal(res.status, 413);
  assert.doesNotMatch(texto, /at .*\.js|PayloadTooLargeError|node_modules/);
});

test('A02: un error de base de datos en la importación CSV no expone el mensaje interno', async (t) => {
  const { restore } = fakeDb([
    [/SELECT id FROM products WHERE id = ANY/i, () => { throw new Error('relation "products" does not exist (detalle interno)'); }],
  ]);
  t.after(restore);

  const csv = 'id,name,price,image,description,stock,salida,corazon,fondo\nnuevo,Nuevo,10.00,,desc,1,a,b,c\n';
  const res = await fetch(`${baseUrl}/imports/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ id: 1, role: 'ADMIN' })}` },
    body: JSON.stringify({ fileName: 'a.csv', csv }),
  });
  const texto = await res.text();
  assert.equal(res.status, 500);
  assert.doesNotMatch(texto, /relation|detalle interno/);
});

test('A02: un error de validación del CSV sí muestra su mensaje (400)', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await fetch(`${baseUrl}/imports/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ id: 1, role: 'ADMIN' })}` },
    body: JSON.stringify({ fileName: 'a.csv', csv: 'columna,rara\n1,2\n' }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /Encabezados inválidos/);
});
