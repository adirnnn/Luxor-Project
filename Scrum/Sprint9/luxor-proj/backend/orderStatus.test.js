// SFTWRKEY-417: estados del pedido, transiciones y PATCH /admin/orders/:id/status
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { ORDER_STATUSES, ORDER_TRANSITIONS, canTransition, isValidStatus } = await import('./services/orderStatus.js');
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

const ran = (log, re) => log.some((e) => re.test(e.sql));
const first = (log, re) => log.find((e) => re.test(e.sql));

const Q = {
  begin: /^BEGIN$/,
  commit: /^COMMIT$/,
  rollback: /^ROLLBACK$/,
  bloquearPedido: /SELECT status FROM orders WHERE id = \$1 FOR UPDATE/i,
  actualizarPedido: /^UPDATE orders SET status/i,
  historial: /INSERT INTO order_status_history/i,
  crearOrden: /INSERT INTO orders/i,
};

const cambiarEstado = (id, body, token = adminToken) =>
  fetch(`${baseUrl}/admin/orders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

// pedido 10 en el estado que se le pase
const pedidoEn = (status) => [
  [Q.bloquearPedido, { rows: [{ status }] }],
  [Q.actualizarPedido, (params) => ({
    rows: [{ id: 10, user_id: 7, total: '390.00', status: params[0], created_at: '2026-10-01' }],
    rowCount: 1,
  })],
];

// ── Mapa de transiciones ─────────────────────────────────────────────────────

test('orderStatus: los 5 estados son válidos y otros no', () => {
  assert.deepEqual(ORDER_STATUSES, ['pagado', 'en_preparacion', 'enviado', 'entregado', 'cancelado']);
  for (const status of ORDER_STATUSES) assert.equal(isValidStatus(status), true);
  for (const status of ['completed', 'pending', 'PAGADO', '', undefined, null]) {
    assert.equal(isValidStatus(status), false, `"${status}"`);
  }
});

test('orderStatus: transiciones permitidas', () => {
  assert.equal(canTransition('pagado', 'en_preparacion'), true);
  assert.equal(canTransition('pagado', 'cancelado'), true);
  assert.equal(canTransition('en_preparacion', 'enviado'), true);
  assert.equal(canTransition('en_preparacion', 'cancelado'), true);
  assert.equal(canTransition('enviado', 'entregado'), true);
});

test('orderStatus: transiciones no permitidas', () => {
  assert.equal(canTransition('entregado', 'pagado'), false);
  assert.equal(canTransition('enviado', 'cancelado'), false, 'un pedido enviado no se cancela');
  assert.equal(canTransition('pagado', 'entregado'), false, 'no se salta estados');
  assert.equal(canTransition('pagado', 'pagado'), false);
  assert.equal(canTransition('completed', 'pagado'), false);
  assert.deepEqual(ORDER_TRANSITIONS.entregado, []);
  assert.deepEqual(ORDER_TRANSITIONS.cancelado, []);
});

// ── Pedido nuevo queda 'pagado' ──────────────────────────────────────────────

test('checkout con sesión: el pedido se guarda como pagado y con su primera fila de historial', async (t) => {
  const { log, restore } = fakeDb([
    [/^CREATE TABLE/i, { rows: [] }],
    [/FROM carts WHERE user_id/i, { rows: [{ id: 55 }] }],
    [/FROM cart_items ci/i, { rows: [{ product_id: 'khamrah', quantity: 1, name: 'Khamrah', price: '390.00', stock: 5 }] }],
    [/UPDATE products SET stock/i, { rows: [{ id: 'khamrah' }] }],
    [Q.crearOrden, { rows: [{ id: 99, created_at: '2026-10-01' }] }],
    [/INSERT INTO payments/i, { rows: [{ id: 1, status: 'aprobado' }] }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/checkout/7`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clienteToken}` },
    body: JSON.stringify({
      cardholderName: 'Ana Cliente', cardNumber: '4242 4242 4242 4242', expiryMonth: '12', expiryYear: '2030',
      cvv: '123', billingAddress: 'Zona 10', city: 'Guatemala', postalCode: '01010', country: 'Guatemala',
    }),
  });
  assert.equal(res.status, 201);

  assert.match(first(log, Q.crearOrden).sql, /'pagado'/);
  assert.deepEqual(first(log, Q.historial).params, [99]);
  assert.match(first(log, Q.historial).sql, /NULL, 'pagado'/);

  const i = log.findIndex((e) => Q.historial.test(e.sql));
  assert.ok(i > log.findIndex((e) => Q.begin.test(e.sql)) && i < log.findIndex((e) => Q.commit.test(e.sql)),
    'el historial se guarda dentro de la transacción');
});

test('checkout de invitado: el pedido se guarda como pagado y con su primera fila de historial', async (t) => {
  const { log, restore } = fakeDb([
    [/FROM guest_receipts/i, { rows: [] }],
    [/FROM products WHERE id=ANY/i, { rows: [{ id: 'khamrah', name: 'Khamrah', price: '390.00', stock: 5 }] }],
    [Q.crearOrden, { rows: [{ id: 120, total: '390.00', created_at: '2026-10-01' }] }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/guest-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      'Idempotency-Key': '11111111-2222-3333-4444-555555555555',
      'X-Forwarded-For': '198.51.100.41',
    },
    body: JSON.stringify({
      guest: { name: 'Invitado Prueba', email: 'invitado@test.com' },
      items: [{ product_id: 'khamrah', quantity: 1 }],
      card: {
        cardholderName: 'Invitado Prueba', cardNumber: '4242 4242 4242 4242', expiryMonth: '12', expiryYear: '2030',
        cvv: '123', billingAddress: 'Zona 10', city: 'Guatemala', postalCode: '01010', country: 'Guatemala',
      },
      expectedCents: 39000,
    }),
  });
  assert.equal(res.status, 201);

  assert.match(first(log, Q.crearOrden).sql, /'pagado'/);
  assert.deepEqual(first(log, Q.historial).params, [120]);
});

// ── PATCH /admin/orders/:id/status ───────────────────────────────────────────

test('PATCH estado: transición válida actualiza el pedido y guarda el historial con quién lo cambió', async (t) => {
  const { log, restore } = fakeDb(pedidoEn('pagado'));
  t.after(restore);

  const res = await cambiarEstado(10, { status: 'en_preparacion' });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.order.status, 'en_preparacion');
  assert.equal(body.order.total, 390);
  assert.deepEqual(first(log, Q.actualizarPedido).params.slice(0, 2), ['en_preparacion', 10]);
  assert.deepEqual(first(log, Q.historial).params, [10, 'pagado', 'en_preparacion', 1]);
  assert.equal(ran(log, Q.commit), true);
});

test('PATCH estado: recorre todo el ciclo pagado → en_preparacion → enviado → entregado', async (t) => {
  for (const [desde, hacia] of [['pagado', 'en_preparacion'], ['en_preparacion', 'enviado'], ['enviado', 'entregado']]) {
    const { restore } = fakeDb(pedidoEn(desde));
    const res = await cambiarEstado(10, { status: hacia });
    restore();
    assert.equal(res.status, 200, `${desde} → ${hacia}`);
  }
});

test('PATCH estado: transición inválida responde 400 con un mensaje claro y no cambia nada', async (t) => {
  for (const [desde, hacia] of [['entregado', 'pagado'], ['enviado', 'cancelado'], ['cancelado', 'pagado'], ['pagado', 'entregado']]) {
    const { log, restore } = fakeDb(pedidoEn(desde));
    const res = await cambiarEstado(10, { status: hacia });
    const body = await res.json();
    restore();

    assert.equal(res.status, 400, `${desde} → ${hacia}`);
    assert.equal(body.message, `No se puede pasar de '${desde}' a '${hacia}'.`);
    assert.equal(ran(log, Q.actualizarPedido), false);
    assert.equal(ran(log, Q.historial), false);
    assert.equal(ran(log, Q.rollback), true);
  }
});

test('PATCH estado: un estado que no existe responde 400 sin tocar la base', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  for (const status of ['completed', 'perdido', '', 5, null]) {
    const res = await cambiarEstado(10, { status });
    assert.equal(res.status, 400, `status ${JSON.stringify(status)}`);
  }
  assert.equal(log.length, 0);
});

test('PATCH estado: un id que no es entero responde 400', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  for (const id of ['abc', '1.5', '-3', '0', '10abc']) {
    const res = await cambiarEstado(id, { status: 'enviado' });
    assert.equal(res.status, 400, `id "${id}"`);
  }
  assert.equal(log.length, 0);
});

test('PATCH estado: un pedido que no existe responde 404', async (t) => {
  const { log, restore } = fakeDb([[Q.bloquearPedido, { rows: [] }]]);
  t.after(restore);

  const res = await cambiarEstado(404, { status: 'enviado' });
  assert.equal(res.status, 404);
  assert.equal(ran(log, Q.actualizarPedido), false);
});

test('PATCH estado: un CLIENTE recibe 403 y sin token 401, sin tocar la base', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  assert.equal((await cambiarEstado(10, { status: 'enviado' }, clienteToken)).status, 403);
  assert.equal((await cambiarEstado(10, { status: 'enviado' }, signToken({ id: 8, role: 'VENDEDOR' }))).status, 403);
  assert.equal((await cambiarEstado(10, { status: 'enviado' }, null)).status, 401);
  assert.equal(log.length, 0);
});

test('PATCH estado: si falla el INSERT del historial se hace ROLLBACK y nunca COMMIT', async (t) => {
  const { log, restore } = fakeDb([
    ...pedidoEn('pagado'),
    [Q.historial, () => { throw new Error('fallo simulado'); }],
  ]);
  t.after(restore);
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });

  const res = await cambiarEstado(10, { status: 'en_preparacion' });
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.ok(!JSON.stringify(body).includes('fallo simulado'));
  assert.equal(ran(log, Q.rollback), true);
  assert.equal(ran(log, Q.commit), false);
});
