// SFTWRKEY-420: GET /user/:userId/orders con productos e historial de estados
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

const Q = {
  pedidos: /FROM orders WHERE user_id = \$1/i,
  items: /FROM order_items oi LEFT JOIN products p/i,
  historial: /FROM order_status_history WHERE order_id = ANY/i,
};

const pedir = (userId, token) =>
  fetch(`${baseUrl}/user/${userId}/orders`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

const DOS_PEDIDOS = [
  [Q.pedidos, { rows: [
    { id: 2, total: '330.00', status: 'enviado', created_at: '2026-10-02' },
    { id: 1, total: '780.00', status: 'cancelado', created_at: '2026-10-01' },
  ] }],
  [Q.items, { rows: [
    { order_id: 1, product_id: 'khamrah', quantity: 2, unit_price: '390.00', name: 'Lattafa Khamrah', image: '/k.png' },
    { order_id: 2, product_id: 'yara', quantity: 1, unit_price: '330.00', name: 'Lattafa Yara', image: '/y.png' },
    { order_id: 2, product_id: 'borrado', quantity: 1, unit_price: '0.00', name: null, image: null },
  ] }],
  [Q.historial, { rows: [
    { order_id: 1, from_status: null, to_status: 'pagado', changed_at: '2026-10-01T10:00:00Z' },
    { order_id: 2, from_status: null, to_status: 'pagado', changed_at: '2026-10-02T10:00:00Z' },
    { order_id: 1, from_status: 'pagado', to_status: 'cancelado', changed_at: '2026-10-01T12:00:00Z' },
    { order_id: 2, from_status: 'pagado', to_status: 'en_preparacion', changed_at: '2026-10-03T10:00:00Z' },
    { order_id: 2, from_status: 'en_preparacion', to_status: 'enviado', changed_at: '2026-10-04T10:00:00Z' },
  ] }],
];

test('pedidos del cliente: cada pedido trae sus productos y su historial de estados', async (t) => {
  const { restore } = fakeDb(DOS_PEDIDOS);
  t.after(restore);

  const res = await pedir(7, signToken({ id: 7, role: 'CLIENTE' }));
  const { orders } = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(orders.map((o) => o.id), [2, 1]);
  assert.deepEqual(orders[0].items.map((i) => i.product_id), ['yara', 'borrado']);
  assert.deepEqual(orders[1].items.map((i) => [i.product_id, i.quantity]), [['khamrah', 2]]);
  assert.deepEqual(orders[0].history.map((h) => h.to_status), ['pagado', 'en_preparacion', 'enviado']);
  assert.deepEqual(orders[1].history.map((h) => h.to_status), ['pagado', 'cancelado']);
  assert.equal(orders[0].history[1].from_status, 'pagado');
  assert.equal('order_id' in orders[0].items[0], false, 'no se repite el order_id dentro de cada renglón');
});

test('pedidos del cliente: un producto que ya no existe se muestra con su id', async (t) => {
  const { restore } = fakeDb(DOS_PEDIDOS);
  t.after(restore);

  const { orders } = await (await pedir(7, signToken({ id: 7, role: 'CLIENTE' }))).json();
  assert.equal(orders[0].items[1].name, 'borrado');
});

test('pedidos del cliente: son 3 consultas sin importar cuántos pedidos haya (sin N+1)', async (t) => {
  const { log, restore } = fakeDb(DOS_PEDIDOS);
  t.after(restore);

  await pedir(7, signToken({ id: 7, role: 'CLIENTE' }));
  assert.equal(log.length, 3);
  assert.deepEqual(log.find((e) => Q.items.test(e.sql)).params, [[2, 1]]);
  assert.deepEqual(log.find((e) => Q.historial.test(e.sql)).params, [[2, 1]]);
  assert.deepEqual(log.find((e) => Q.pedidos.test(e.sql)).params, ['7']);
});

test('pedidos del cliente: sin pedidos no consulta productos ni historial', async (t) => {
  const { log, restore } = fakeDb([[Q.pedidos, { rows: [] }]]);
  t.after(restore);

  const res = await pedir(7, signToken({ id: 7, role: 'CLIENTE' }));
  assert.deepEqual((await res.json()).orders, []);
  assert.equal(log.length, 1);
});

test('pedidos del cliente: la respuesta no se guarda en caché', async (t) => {
  const { restore } = fakeDb(DOS_PEDIDOS);
  t.after(restore);

  const res = await pedir(7, signToken({ id: 7, role: 'CLIENTE' }));
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('el cliente A no puede ver los pedidos del cliente B (403) y sin token 401', async (t) => {
  const { log, restore } = fakeDb(DOS_PEDIDOS);
  t.after(restore);

  assert.equal((await pedir(8, signToken({ id: 7, role: 'CLIENTE' }))).status, 403);
  assert.equal((await pedir(8, null)).status, 401);
  assert.equal(log.length, 0, 'no se consulta la base');
});
