// SFTWRKEY-419: GET /admin/orders y GET /admin/orders/:id
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { default: app } = await import('./server.js');

const adminToken = signToken({ id: 1, role: 'ADMIN' });
const clienteToken = signToken({ id: 7, role: 'CLIENTE' });

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

const first = (log, re) => log.find((e) => re.test(e.sql));

const Q = {
  contar: /^SELECT COUNT\(\*\)::int AS total FROM orders o/i,
  listar: /FROM orders o LEFT JOIN users u[\s\S]*LIMIT \$4 OFFSET \$5/i,
  pedido: /FROM orders o LEFT JOIN users u[\s\S]*WHERE o\.id = \$1/i,
  items: /FROM order_items oi LEFT JOIN products p/i,
  historial: /FROM order_status_history h/i,
};

const pedir = (ruta, token = adminToken) =>
  fetch(`${baseUrl}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

// ── Acceso ───────────────────────────────────────────────────────────────────

test('pedidos del admin: sin token 401 y CLIENTE/VENDEDOR 403, sin tocar la base', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  for (const ruta of ['/admin/orders', '/admin/orders/5']) {
    assert.equal((await pedir(ruta, null)).status, 401, ruta);
    assert.equal((await pedir(ruta, clienteToken)).status, 403, ruta);
    assert.equal((await pedir(ruta, signToken({ id: 8, role: 'VENDEDOR' }))).status, 403, ruta);
  }
  assert.equal(log.length, 0);
});

// ── GET /admin/orders ────────────────────────────────────────────────────────

test('GET /admin/orders: sin filtros pide la primera página de 20', async (t) => {
  const { log, restore } = fakeDb([[Q.contar, { rows: [{ total: 0 }] }]]);
  t.after(restore);

  const res = await pedir('/admin/orders');
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body, { success: true, orders: [], total: 0, page: 1, limit: 20 });
  assert.deepEqual(first(log, Q.listar).params, [null, null, null, 20, 0]);
  assert.deepEqual(first(log, Q.contar).params, [null, null, null]);
});

test('GET /admin/orders: los filtros y la página van como parámetros', async (t) => {
  const { log, restore } = fakeDb([[Q.contar, { rows: [{ total: 35 }] }]]);
  t.after(restore);

  const res = await pedir('/admin/orders?status=enviado&from=2026-10-01&to=2026-10-31&page=3&limit=10');
  assert.equal(res.status, 200);
  assert.deepEqual(first(log, Q.listar).params, ['enviado', '2026-10-01', '2026-10-31', 10, 20]);
  // 'to' incluye todo ese día
  assert.match(first(log, Q.listar).sql, /o\.created_at < \$3::date \+ 1/);
  assert.equal((await res.json()).total, 35);
});

test('GET /admin/orders: arma cliente, invitado, total y cantidad de productos', async (t) => {
  const { restore } = fakeDb([
    [Q.contar, { rows: [{ total: 3 }] }],
    [Q.listar, { rows: [
      { id: 3, created_at: '2026-10-03', total: '780.00', status: 'pagado', user_name: 'María García', user_email: 'maria@luxor.com', guest_name: null, guest_email: null, items_count: 2 },
      { id: 2, created_at: '2026-10-02', total: '390.00', status: 'enviado', user_name: null, user_email: null, guest_name: 'Pedro', guest_email: 'pedro@test.com', items_count: 1 },
      { id: 1, created_at: '2026-10-01', total: '100.00', status: 'cancelado', user_name: null, user_email: null, guest_name: null, guest_email: null, items_count: 1 },
    ] }],
  ]);
  t.after(restore);

  const body = await (await pedir('/admin/orders')).json();
  assert.deepEqual(body.orders.map((o) => [o.id, o.customer_name, o.customer_email, o.is_guest, o.total, o.items_count]), [
    [3, 'María García', 'maria@luxor.com', false, 780, 2],
    [2, 'Invitado · Pedro', 'pedro@test.com', true, 390, 1],
    [1, 'Invitado', null, true, 100, 1],
  ]);
});

test('GET /admin/orders: parámetros inválidos responden 400 sin tocar la base', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  for (const query of [
    'status=completed', 'status=PAGADO',
    'from=01-10-2026', 'to=2026-13-01', 'from=2026-02-30', 'from=hoy',
    'from=2026-10-31&to=2026-10-01',
    'page=0', 'page=-1', 'page=1.5', 'page=abc',
    'limit=0', 'limit=51', 'limit=abc',
    // parametros repetidos llegan como arreglo
    'status=pagado&status=enviado', 'from=2026-10-01&from=2026-10-02', 'page=1&page=2',
  ]) {
    const res = await pedir(`/admin/orders?${query}`);
    assert.equal(res.status, 400, query);
  }
  assert.equal(log.length, 0);
});

test('GET /admin/orders: un error de la base responde 500 genérico', async (t) => {
  const { restore } = fakeDb([[Q.contar, () => { throw new Error('detalle interno de postgres'); }]]);
  t.after(restore);
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });

  const res = await pedir('/admin/orders');
  assert.equal(res.status, 500);
  assert.ok(!JSON.stringify(await res.json()).includes('postgres'));
});

// ── GET /admin/orders/:id ────────────────────────────────────────────────────

test('GET /admin/orders/:id: detalle con productos, subtotal, historial y estados permitidos', async (t) => {
  const { log, restore } = fakeDb([
    [Q.pedido, { rows: [{ id: 5, created_at: '2026-10-05', total: '820.00', status: 'pagado', user_name: null, user_email: null, guest_name: 'Pedro', guest_email: 'pedro@test.com', address: { billingAddress: 'Zona 1', city: 'Guatemala', postalCode: '01001', country: 'Guatemala' } }] }],
    [Q.items, { rows: [
      { product_id: 'khamrah', name: 'Lattafa Khamrah', image: '/k.png', quantity: 2, unit_price: '390.00' },
      { product_id: 'borrado', name: null, image: null, quantity: 1, unit_price: '40.00' },
    ] }],
    [Q.historial, { rows: [{ from_status: null, to_status: 'pagado', changed_at: '2026-10-05', changed_by_name: null }] }],
  ]);
  t.after(restore);

  const res = await pedir('/admin/orders/5');
  const { order } = await res.json();

  assert.equal(res.status, 200);
  assert.equal(order.customer_name, 'Invitado · Pedro');
  assert.equal(order.total, 820);
  // SFTWRKEY-449: un pedido de invitado anterior al cambio usa la dirección de guest_receipts
  assert.deepEqual(order.delivery, {
    method: 'envio',
    address: { billingAddress: 'Zona 1', city: 'Guatemala', postalCode: '01001', country: 'Guatemala' },
  });
  assert.equal(order.shipping, 0);
  assert.deepEqual(order.items.map((i) => [i.name, i.quantity, i.unit_price, i.subtotal]), [
    ['Lattafa Khamrah', 2, 390, 780],
    ['borrado', 1, 40, 40],
  ]);
  assert.equal(order.history.length, 1);
  assert.deepEqual(order.allowedNextStatuses, ['en_preparacion', 'cancelado']);
  assert.deepEqual(first(log, Q.items).params, [5]);
});

test('GET /admin/orders/:id: un pedido entregado no ofrece ningún cambio de estado', async (t) => {
  const { restore } = fakeDb([
    [Q.pedido, { rows: [{ id: 6, created_at: '2026-10-05', total: '100.00', status: 'entregado', user_name: 'Ana', user_email: 'ana@test.com', guest_name: null, guest_email: null, address: null }] }],
  ]);
  t.after(restore);

  const { order } = await (await pedir('/admin/orders/6')).json();
  assert.deepEqual(order.allowedNextStatuses, []);
  assert.equal(order.delivery, null);
});

test('GET /admin/orders/:id: id inválido 400 y pedido que no existe 404', async (t) => {
  const { log, restore } = fakeDb([[Q.pedido, { rows: [] }]]);
  t.after(restore);

  for (const id of ['abc', '0', '-1', '1.5']) {
    assert.equal((await pedir(`/admin/orders/${id}`)).status, 400, id);
  }
  assert.equal(log.length, 0);
  assert.equal((await pedir('/admin/orders/999')).status, 404);
});
