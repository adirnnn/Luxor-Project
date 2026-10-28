// SFTWRKEY-458: consulta del estado de un pedido desde el chatbot (número + correo).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';
process.env.CHATBOT_INTERNAL_KEY = 'clave-interna-de-prueba';

const { default: pool } = await import('./db.js');
const { default: app } = await import('./server.js');
const { reiniciarLimites, LIMITES } = await import('./routes/orderLookup.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => reiniciarLimites());

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

const PEDIDO = {
  id: 15, status: 'enviado', created_at: '2026-10-20T15:00:00.000Z', updated_at: '2026-10-22T10:00:00.000Z',
  // columnas que NO deben salir aunque la consulta las trajera
  total: '650.00', user_name: 'Ana', guest_address: { calle: 'x' },
};

// la base solo encuentra el pedido 15 con el correo ana@luxor.com
const baseDePedidos = [/FROM orders o/i, (params) => ({
  rows: params[0] === 15 && params[1] === 'ana@luxor.com' ? [PEDIDO] : [],
})];

const consultar = (body, { clave = 'clave-interna-de-prueba', ip = '203.0.113.5' } = {}) =>
  fetch(`${baseUrl}/internal/orders/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(clave ? { 'X-Internal-Key': clave } : {}), ...(ip ? { 'X-Client-IP': ip } : {}) },
    body: JSON.stringify(body),
  });

const consultasDePedido = (log) => log.filter((e) => /FROM orders o/i.test(e.sql));

test('sin la clave interna o con una clave falsa responde 401 y no consulta la base', async (t) => {
  const { log, restore } = fakeDb([baseDePedidos]);
  t.after(restore);

  assert.equal((await consultar({ order_id: 15, email: 'ana@luxor.com' }, { clave: null })).status, 401);
  assert.equal((await consultar({ order_id: 15, email: 'ana@luxor.com' }, { clave: 'clave-falsa-de-pruebas' })).status, 401);
  assert.equal(consultasDePedido(log).length, 0);
});

test('con número y correo correctos responde el estado del pedido y nada más', async (t) => {
  const { log, restore } = fakeDb([baseDePedidos]);
  t.after(restore);

  // el correo se compara sin importar mayúsculas ni espacios
  const res = await consultar({ order_id: 15, email: '  Ana@Luxor.com ' });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body, {
    found: true,
    order: { id: 15, status: 'enviado', created_at: PEDIDO.created_at, updated_at: PEDIDO.updated_at },
  });
  const [consulta] = consultasDePedido(log);
  assert.deepEqual(consulta.params, [15, 'ana@luxor.com']);
  // busca el correo del cliente con cuenta y también el del invitado
  assert.match(consulta.sql, /COALESCE\(u\.email, g\.guest_email\)/);
});

test('datos que no coinciden responden "no encontrado" sin detalles, igual que un pedido que no existe', async (t) => {
  const { restore } = fakeDb([baseDePedidos]);
  t.after(restore);

  const correoAjeno = await consultar({ order_id: 15, email: 'otra@luxor.com' });
  const noExiste = await consultar({ order_id: 999, email: 'ana@luxor.com' });

  assert.equal(correoAjeno.status, 404);
  assert.equal(noExiste.status, 404);
  const a = await correoAjeno.json();
  const b = await noExiste.json();
  assert.deepEqual(a, { found: false, message: 'No encontramos ese pedido.' });
  assert.deepEqual(a, b);
});

test('número o correo no válidos responden 400 sin consultar la base', async (t) => {
  const { log, restore } = fakeDb([baseDePedidos]);
  t.after(restore);

  for (const [i, body] of [
    { order_id: 'abc', email: 'ana@luxor.com' }, { order_id: -3, email: 'ana@luxor.com' },
    { order_id: 1.5, email: 'ana@luxor.com' }, { order_id: 99999999999, email: 'ana@luxor.com' },
    { order_id: 15, email: 'no-es-correo' }, { order_id: 15 }, { order_id: 15, email: `${'a'.repeat(250)}@x.com` },
    { order_id: "15' OR 1=1--", email: 'ana@luxor.com' },
  ].entries()) {
    // una ip distinta en cada una para no llegar al límite por cliente
    assert.equal((await consultar(body, { ip: `198.51.100.${i + 50}` })).status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(consultasDePedido(log).length, 0);
});

test(`un mismo cliente solo puede consultar ${LIMITES.cliente.max} veces cada 15 min y se avisa al admin una vez`, async (t) => {
  const { log, restore } = fakeDb([baseDePedidos]);
  t.after(restore);

  for (let i = 0; i < LIMITES.cliente.max; i++) {
    assert.equal((await consultar({ order_id: 15, email: 'ana@luxor.com' })).status, 200);
  }
  assert.equal((await consultar({ order_id: 15, email: 'ana@luxor.com' })).status, 429);
  assert.equal((await consultar({ order_id: 15, email: 'ana@luxor.com' })).status, 429);
  // otro cliente (otra ip) no queda bloqueado
  assert.equal((await consultar({ order_id: 15, email: 'ana@luxor.com' }, { ip: '198.51.100.7' })).status, 200);

  const avisos = log.filter((e) => /INSERT INTO security_events/i.test(e.sql));
  assert.equal(avisos.length, 1);
  assert.deepEqual(avisos[0].params.slice(0, 2), ['RATE_LIMITED', '203.0.113.5']);
});

test('adivinar correos para un número: después de 5 fallos el pedido se bloquea aunque cambie la ip', async (t) => {
  const { restore } = fakeDb([baseDePedidos]);
  t.after(restore);

  for (let i = 0; i < LIMITES.pedido.max; i++) {
    const res = await consultar({ order_id: 15, email: `prueba${i}@luxor.com` }, { ip: `198.51.100.${i + 10}` });
    assert.equal(res.status, 404);
  }
  const res = await consultar({ order_id: 15, email: 'otra@luxor.com' }, { ip: '198.51.100.99' });
  assert.equal(res.status, 429);
});

test('adivinar números para un correo: después de 10 fallos el correo se bloquea aunque cambie la ip', async (t) => {
  const { restore } = fakeDb([baseDePedidos]);
  t.after(restore);

  for (let i = 0; i < LIMITES.correo.max; i++) {
    const res = await consultar({ order_id: 100 + i, email: 'ana@luxor.com' }, { ip: `192.0.2.${i + 10}` });
    assert.equal(res.status, 404);
  }
  assert.equal((await consultar({ order_id: 200, email: 'ana@luxor.com' }, { ip: '192.0.2.99' })).status, 429);
});

test('una ip enviada con formato raro no se usa para el límite', async (t) => {
  const { restore } = fakeDb([baseDePedidos]);
  t.after(restore);

  // todas caen en la misma ip real (la del chatbot), así que el límite sí aplica
  for (let i = 0; i < LIMITES.cliente.max; i++) {
    await consultar({ order_id: 15, email: 'ana@luxor.com' }, { ip: `<script>${i}` });
  }
  assert.equal((await consultar({ order_id: 15, email: 'ana@luxor.com' }, { ip: 'x'.repeat(80) })).status, 429);
});

test('si la base falla responde 500 sin mostrar el error', async (t) => {
  const { restore } = fakeDb([[/FROM orders o/i, () => { throw new Error('conexion perdida con la base'); }]]);
  t.after(restore);

  const res = await consultar({ order_id: 15, email: 'ana@luxor.com' });
  assert.equal(res.status, 500);
  assert.doesNotMatch(await res.text(), /conexion perdida/);
});
