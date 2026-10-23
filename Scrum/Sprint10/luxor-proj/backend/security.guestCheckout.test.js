// SFTWRKEY-410: controles del checkout de invitado (SEC-29): rate limit, bloqueo después
// de 3 pagos rechazados y precio tomado de la base de datos.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';
process.env.PAYMENT_GATEWAY_LATENCY_MS = '0';

const { default: pool } = await import('./db.js');
const { default: app } = await import('./server.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Doble del pool de PostgreSQL (mismo patrón que orderStatus.test.js).
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
  productos: /SELECT id, name, price, stock FROM products/i,
  crearOrden: /INSERT INTO orders/i,
  itemsOrden: /INSERT INTO order_items/i,
  eventoSeguridad: /INSERT INTO security_events/i,
  rollback: /^ROLLBACK$/,
};

const count = (log, re) => log.filter((e) => re.test(e.sql)).length;

// Khamrah cuesta Q390.00 en la base de datos.
const tienda = () => fakeDb([
  [Q.productos, { rows: [{ id: 'khamrah', name: 'Lattafa Khamrah', price: '390.00', stock: 10 }] }],
  [Q.crearOrden, (params) => ({ rows: [{ id: 500, total: params[0], created_at: '2026-10-13T00:00:00Z' }] })],
]);

const APROBADA = '4242 4242 4242 4242';
const RECHAZADA = '4000 0000 0000 0002';

const comprar = (ip, { cardNumber = APROBADA, items = [{ product_id: 'khamrah', quantity: 1 }], expectedCents = 39000, extra = {} } = {}) =>
  fetch(`${baseUrl}/guest-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      'Idempotency-Key': randomUUID(),
      'X-Forwarded-For': ip,
    },
    body: JSON.stringify({
      guest: { name: 'Invitado Prueba', email: 'invitado@test.com' },
      items,
      card: {
        cardholderName: 'Invitado Prueba', cardNumber, expiryMonth: '12', expiryYear: '2030',
        cvv: '123', billingAddress: 'Zona 10', city: 'Guatemala', postalCode: '01010', country: 'Guatemala',
      },
      expectedCents,
      ...extra,
    }),
  });

// ── 1. Rate limit ───────────────────────────────────────────────────────────

test('SEC-29 rate limit: la petición 16 en un minuto desde la misma IP responde 429; otra IP sigue', async (t) => {
  const { log, restore } = tienda();
  t.after(restore);

  for (let i = 1; i <= 15; i += 1) {
    const res = await comprar('203.0.113.101');
    assert.equal(res.status, 201, `la compra ${i} de 15 se permite`);
  }

  const bloqueada = await comprar('203.0.113.101');
  assert.equal(bloqueada.status, 429);
  assert.equal(count(log, Q.crearOrden), 15, 'la petición bloqueada no crea pedido');

  const otraIp = await comprar('198.51.100.101');
  assert.equal(otraIp.status, 201, 'otra IP puede seguir comprando');

  const evento = log.find((e) => Q.eventoSeguridad.test(e.sql));
  assert.deepEqual(evento?.params, ['RATE_LIMITED', '203.0.113.101', null, '/guest-checkout']);
});

// ── 2. Bloqueo después de 3 pagos rechazados ────────────────────────────────

test('SEC-29 rechazos: después de 3 pagos rechazados la IP queda bloqueada, aunque use una tarjeta válida', async (t) => {
  const { log, restore } = tienda();
  t.after(restore);

  for (let i = 1; i <= 3; i += 1) {
    const res = await comprar('203.0.113.102', { cardNumber: RECHAZADA });
    assert.equal(res.status, 402, `el rechazo ${i} llega a la pasarela`);
  }
  assert.equal(count(log, Q.crearOrden), 0, 'un pago rechazado no crea pedido');

  const cuarto = await comprar('203.0.113.102', { cardNumber: APROBADA });
  assert.equal(cuarto.status, 429, 'la 4.ª compra queda bloqueada aunque la tarjeta sea válida');
  assert.match((await cuarto.json()).message, /pagos rechazados/i);
  assert.equal(count(log, Q.productos), 3, 'el intento bloqueado no llega a la base ni a la pasarela');

  const otraIp = await comprar('198.51.100.102', { cardNumber: APROBADA });
  assert.equal(otraIp.status, 201, 'otra IP puede seguir comprando');

  const evento = log.find((e) => Q.eventoSeguridad.test(e.sql));
  assert.deepEqual(evento?.params, ['RATE_LIMITED', '203.0.113.102', null, '/guest-checkout'], 'el bloqueo aparece en las alertas');
});

test('SEC-29 rechazos: 2 rechazos no bloquean; la compra siguiente con una tarjeta válida pasa', async (t) => {
  const { restore } = tienda();
  t.after(restore);

  for (let i = 1; i <= 2; i += 1) {
    assert.equal((await comprar('203.0.113.103', { cardNumber: RECHAZADA })).status, 402);
  }
  assert.equal((await comprar('203.0.113.103', { cardNumber: APROBADA })).status, 201);
});

// ── 3. El precio sale de la base de datos ───────────────────────────────────

test('SEC-29 precio: un precio o total enviado por el cliente se ignora; se cobra el precio de la base', async (t) => {
  const { log, restore } = tienda();
  t.after(restore);

  const res = await comprar('203.0.113.104', {
    items: [{ product_id: 'khamrah', quantity: 2, price: 1, unit_price: 1 }],
    expectedCents: 78000,
    extra: { total: 2, amount: 2, price: 1 },
  });
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.order.total, 780, 'el total es 2 × Q390 de la base');
  assert.deepEqual(log.find((e) => Q.crearOrden.test(e.sql)).params, [780]);
  assert.deepEqual(log.find((e) => Q.itemsOrden.test(e.sql)).params, [500, 'khamrah', 2, 390]);
});

test('SEC-29 precio: si el total que espera el cliente no coincide con la base, responde 409 y no cobra', async (t) => {
  const { log, restore } = tienda();
  t.after(restore);

  // el cliente intenta pagar Q1.00 por un perfume de Q390.00
  const res = await comprar('203.0.113.105', { expectedCents: 100 });

  assert.equal(res.status, 409);
  assert.match((await res.json()).message, /precio cambió/i);
  assert.equal(count(log, Q.crearOrden), 0, 'no se crea el pedido');
  assert.equal(count(log, Q.rollback), 1, 'la transacción se deshace');
});
