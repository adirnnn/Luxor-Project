// Integración: SFTWRKEY-417/418, cambio de estado del pedido por el admin y devolución
// de stock al cancelar, con la API real y PostgreSQL real.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, api, registerClient, insertProduct, productStock, cleanup, pool,
  cardPayload, loginAdmin,
} from './helpers.js';

const created = { users: [], products: [] };
let client;
let adminToken;

before(async () => {
  await startServer();
  client = await registerClient(created.users);
  adminToken = await loginAdmin();
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

const cambiarEstado = (orderId, status) =>
  api('PATCH', `/admin/orders/${orderId}/status`, { token: adminToken, body: { status } });

// compra real por la API: llena el carrito y paga
async function comprar(perfume, quantity) {
  await api('POST', `/cart/${client.id}`, { token: client.token, body: [{ product_id: perfume.id, quantity }] });
  const res = await api('POST', `/checkout/${client.id}`, { token: client.token, body: cardPayload() });
  assert.equal(res.status, 201);
  return res.body.order.id;
}

test('cancelar un pedido de 2 unidades aumenta el stock en 2', async () => {
  const perfume = await insertProduct(created.products, { price: 120, stock: 5 });
  const orderId = await comprar(perfume, 2);
  assert.equal(await productStock(perfume.id), 3, 'la compra descuenta 2');

  const res = await cambiarEstado(orderId, 'cancelado');
  assert.equal(res.status, 200);
  assert.equal(res.body.order.status, 'cancelado');
  assert.equal(await productStock(perfume.id), 5, 'al cancelar regresan las 2 unidades');

  const historial = await pool.query(
    'SELECT from_status, to_status FROM order_status_history WHERE order_id = $1 ORDER BY id', [orderId]
  );
  assert.deepEqual(historial.rows, [
    { from_status: null, to_status: 'pagado' },
    { from_status: 'pagado', to_status: 'cancelado' },
  ]);
});

test('cancelar dos veces no devuelve el stock dos veces', async () => {
  const perfume = await insertProduct(created.products, { price: 120, stock: 4 });
  const orderId = await comprar(perfume, 1);

  assert.equal((await cambiarEstado(orderId, 'cancelado')).status, 200);
  assert.equal(await productStock(perfume.id), 4);

  const otraVez = await cambiarEstado(orderId, 'cancelado');
  assert.equal(otraVez.status, 400);
  assert.equal(await productStock(perfume.id), 4, 'el stock no sube otra vez');
});

test('un pedido enviado ya no se puede cancelar y su stock no cambia', async () => {
  const perfume = await insertProduct(created.products, { price: 120, stock: 3 });
  const orderId = await comprar(perfume, 1);
  assert.equal((await cambiarEstado(orderId, 'en_preparacion')).status, 200);
  assert.equal((await cambiarEstado(orderId, 'enviado')).status, 200);

  const res = await cambiarEstado(orderId, 'cancelado');
  assert.equal(res.status, 400);
  assert.equal(await productStock(perfume.id), 2);
});

test('si el mismo perfume viene en dos renglones del pedido se devuelven las dos cantidades', async () => {
  const perfume = await insertProduct(created.products, { price: 100, stock: 10 });
  const { rows: [order] } = await pool.query(
    `INSERT INTO orders (user_id, total, status) VALUES ($1, 300, 'pagado') RETURNING id`, [client.id]
  );
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, 100), ($1, $2, 2, 100)`,
    [order.id, perfume.id]
  );

  assert.equal((await cambiarEstado(order.id, 'cancelado')).status, 200);
  assert.equal(await productStock(perfume.id), 13, '10 + 1 + 2');
});
