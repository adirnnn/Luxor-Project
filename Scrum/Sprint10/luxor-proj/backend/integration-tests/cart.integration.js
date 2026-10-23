// Integración: carrito (rutas + autorización) + PostgreSQL (carts, cart_items, FK a products)
// con transacción BEGIN/COMMIT/ROLLBACK.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, api, registerClient, insertProduct, cleanup, pool } from './helpers.js';

const created = { users: [], products: [] };
let client;
let perfumeA;
let perfumeB;

before(async () => {
  await startServer();
  client = await registerClient(created.users);
  perfumeA = await insertProduct(created.products, { stock: 10 });
  perfumeB = await insertProduct(created.products, { stock: 10 });
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

const itemsEnBase = async (userId) => {
  const { rows } = await pool.query(
    `SELECT ci.product_id, ci.quantity
     FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
     WHERE c.user_id = $1 ORDER BY ci.product_id`,
    [userId]
  );
  return rows;
};

test('POST /cart/:userId persiste los items y GET /cart/:userId los devuelve', async () => {
  const items = [
    { product_id: perfumeA.id, quantity: 2 },
    { product_id: perfumeB.id, quantity: 1 },
  ];
  const guardado = await api('POST', `/cart/${client.id}`, { token: client.token, body: items });
  assert.equal(guardado.status, 200);

  const esperado = [...items].sort((a, b) => a.product_id.localeCompare(b.product_id));
  assert.deepEqual(await itemsEnBase(client.id), esperado);

  const leido = await api('GET', `/cart/${client.id}`, { token: client.token });
  assert.equal(leido.status, 200);
  assert.deepEqual([...leido.body].sort((a, b) => a.product_id.localeCompare(b.product_id)), esperado);
});

test('un producto inexistente viola la FK, la transacción hace ROLLBACK y el carrito previo se conserva', async (t) => {
  // El servidor registra el error de la FK con console.error: es esperado, se silencia.
  t.mock.method(console, 'error', () => {});
  const antes = await itemsEnBase(client.id);

  const res = await api('POST', `/cart/${client.id}`, {
    token: client.token,
    body: [{ product_id: perfumeA.id, quantity: 5 }, { product_id: 'no-existe-este-perfume', quantity: 1 }],
  });

  assert.equal(res.status, 500);
  assert.deepEqual(await itemsEnBase(client.id), antes, 'el DELETE e INSERT parciales se revierten');
});
