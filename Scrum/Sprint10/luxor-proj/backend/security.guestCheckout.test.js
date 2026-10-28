// SFTWRKEY-410: controles del checkout de invitado (SEC-29): rate limit y precio tomado de la base.
// SFTWRKEY-445: el pago se abre en Recurrente (aquí simulado); los rechazos de tarjeta pasan en su
// página, por eso ya no está el bloqueo por 3 rechazos de este servidor.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'test-secret';

const { default: pool } = await import('./db.js');
const { default: app } = await import('./server.js');
const { gateway } = await import('./services/paymentGateway.js');

// Recurrente simulado: guarda lo que se le pidió y devuelve un enlace falso
const checkoutsPedidos = [];
gateway.createCheckout = async (request) => {
  checkoutsPedidos.push(request);
  return { id: `ch_${checkoutsPedidos.length}`, url: 'https://recurrente.test/checkout', status: 'unpaid' };
};

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
  crearSesion: /INSERT INTO checkout_sessions/i,
  eventoSeguridad: /INSERT INTO security_events/i,
  rollback: /^ROLLBACK$/,
};

const count = (log, re) => log.filter((e) => re.test(e.sql)).length;

// Khamrah cuesta Q390.00 en la base de datos.
const tienda = () => fakeDb([
  [Q.productos, { rows: [{ id: 'khamrah', name: 'Lattafa Khamrah', price: '390.00', stock: 10 }] }],
]);

const comprar = (ip, { items = [{ product_id: 'khamrah', quantity: 1 }], expectedCents = 39000, extra = {} } = {}) =>
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
      address: { billingAddress: 'Zona 10', city: 'Guatemala', postalCode: '01010', country: 'Guatemala' },
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
    assert.equal(res.status, 201, `el pago ${i} de 15 se abre`);
  }

  const bloqueada = await comprar('203.0.113.101');
  assert.equal(bloqueada.status, 429);
  assert.equal(count(log, Q.crearSesion), 15, 'la petición bloqueada no aparta stock');

  const otraIp = await comprar('198.51.100.101');
  assert.equal(otraIp.status, 201, 'otra IP puede seguir comprando');

  const evento = log.find((e) => Q.eventoSeguridad.test(e.sql));
  assert.deepEqual(evento?.params, ['RATE_LIMITED', '203.0.113.101', null, '/guest-checkout']);
});

// ── 2. Precio tomado de la base ─────────────────────────────────────────────

test('SEC-29 precio: un precio o total enviado por el cliente se ignora; a Recurrente va el precio de la base', async (t) => {
  const { log, restore } = tienda();
  t.after(restore);
  const antes = checkoutsPedidos.length;

  const res = await comprar('203.0.113.104', {
    items: [{ product_id: 'khamrah', quantity: 2, price: 1, unit_price: 1 }],
    expectedCents: 78000,
    extra: { total: 2, amount: 2, price: 1 },
  });
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.checkoutUrl, 'https://recurrente.test/checkout');
  const sesion = log.find((e) => Q.crearSesion.test(e.sql)).params;
  assert.equal(sesion[4], 780, 'el total es 2 × Q390 de la base');
  assert.deepEqual(checkoutsPedidos[antes].items, [{ product_id: 'khamrah', name: 'Lattafa Khamrah', quantity: 2, price: 390 }]);
});

test('SEC-29 precio: si el total que espera el cliente no coincide con la base, responde 409 y no abre el pago', async (t) => {
  const { log, restore } = tienda();
  t.after(restore);
  const antes = checkoutsPedidos.length;

  // el cliente intenta pagar Q1.00 por un perfume de Q390.00
  const res = await comprar('203.0.113.105', { expectedCents: 100 });

  assert.equal(res.status, 409);
  assert.match((await res.json()).message, /precio cambió/i);
  assert.equal(count(log, Q.crearSesion), 0, 'no se aparta stock');
  assert.equal(checkoutsPedidos.length, antes, 'no se llama a Recurrente');
  assert.equal(count(log, Q.rollback), 1, 'la transacción se deshace');
});

test('el checkout de invitado ya no recibe tarjetas: sin dirección responde 400', async (t) => {
  const { restore } = tienda();
  t.after(restore);

  const res = await fetch(`${baseUrl}/guest-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      'Idempotency-Key': randomUUID(),
      'X-Forwarded-For': '203.0.113.106',
    },
    body: JSON.stringify({
      guest: { name: 'Invitado Prueba', email: 'invitado@test.com' },
      items: [{ product_id: 'khamrah', quantity: 1 }],
      card: { cardNumber: '4242424242424242', cvv: '123' },
      expectedCents: 39000,
    }),
  });
  assert.equal(res.status, 400);
});
