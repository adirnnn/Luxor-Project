// SFTWRKEY-391: el carrito acepta como máximo 10 unidades por producto (mismo tope que el frontend).
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

function fakeDb() {
  const log = [];
  const original = { query: pool.query, connect: pool.connect };
  const run = async (sql, params) => {
    log.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
    if (/SELECT id FROM carts/i.test(sql)) return { rows: [{ id: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  };
  pool.query = run;
  pool.connect = async () => ({ query: run, release() {} });
  return { log, restore: () => { pool.query = original.query; pool.connect = original.connect; } };
}

const guardarCarrito = (items) =>
  fetch(`${baseUrl}/cart/7`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ id: 7, role: 'CLIENTE' })}` },
    body: JSON.stringify(items),
  });

test('POST /cart: 11 unidades de un producto responde 400 sin tocar la base', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await guardarCarrito([{ product_id: 'khamrah', quantity: 11 }]);
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /máxima por producto es 10/);
  assert.equal(log.length, 0);
});

test('POST /cart: 10 unidades (el tope) se aceptan', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await guardarCarrito([{ product_id: 'khamrah', quantity: 10 }]);
  assert.equal(res.status, 200);
});
