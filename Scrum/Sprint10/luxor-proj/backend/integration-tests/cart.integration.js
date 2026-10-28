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

// SFTWRKEY-456: lo encontraron las pruebas de extremo a extremo. Al iniciar sesión y agregar un
// perfume, el frontend manda dos sincronizaciones casi juntas; si el cliente todavía no tenía
// carrito, las dos intentaban crearlo y una fallaba con 500 (carts_user_id_key).
test('dos sincronizaciones al mismo tiempo de un cliente sin carrito responden 200 y no pierden el carrito', async () => {
  for (let intento = 0; intento < 5; intento++) {
    const nuevo = await registerClient(created.users);
    const respuestas = await Promise.all([
      api('POST', `/cart/${nuevo.id}`, { token: nuevo.token, body: [{ product_id: perfumeA.id, quantity: 1 }] }),
      api('POST', `/cart/${nuevo.id}`, { token: nuevo.token, body: [{ product_id: perfumeB.id, quantity: 2 }] }),
    ]);
    assert.deepEqual(respuestas.map((r) => r.status), [200, 200], `intento ${intento + 1}`);

    // un solo carrito y con los items de una de las dos (la última que terminó)
    const { rows } = await pool.query('SELECT COUNT(*)::int AS carritos FROM carts WHERE user_id = $1', [nuevo.id]);
    assert.equal(rows[0].carritos, 1);
    const items = await itemsEnBase(nuevo.id);
    assert.equal(items.length, 1);
    assert.ok([perfumeA.id, perfumeB.id].includes(items[0].product_id));
  }
});
