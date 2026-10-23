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

// ── SFTWRKEY-419: lista y detalle de pedidos para el admin ──────────────────

const listar = (query = '') => api('GET', `/admin/orders${query}`, { token: adminToken });

test('GET /admin/orders filtra por estado y por fechas, y "hasta" incluye todo ese día', async () => {
  const perfume = await insertProduct(created.products, { price: 50, stock: 20 });
  const { rows: [tarde] } = await pool.query(
    `INSERT INTO orders (user_id, total, status, created_at) VALUES ($1, 50, 'enviado', '2026-03-15 23:30:00') RETURNING id`, [client.id]
  );
  const { rows: [otroDia] } = await pool.query(
    `INSERT INTO orders (user_id, total, status, created_at) VALUES ($1, 50, 'enviado', '2026-03-16 00:10:00') RETURNING id`, [client.id]
  );
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $3, 2, 25), ($2, $3, 1, 50)`,
    [tarde.id, otroDia.id, perfume.id]
  );

  const res = await listar('?status=enviado&from=2026-03-15&to=2026-03-15');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.orders.map((o) => o.id), [tarde.id], 'el pedido de las 23:30 entra; el del día siguiente no');
  assert.equal(res.body.total, 1);
  assert.equal(res.body.orders[0].items_count, 2);
  assert.equal(res.body.orders[0].customer_email, client.email);

  const ambos = await listar('?status=enviado&from=2026-03-15&to=2026-03-16');
  assert.deepEqual(ambos.body.orders.map((o) => o.id), [otroDia.id, tarde.id], 'más reciente primero');
});

test('GET /admin/orders pagina los resultados', async () => {
  const res = await listar('?from=2026-03-15&to=2026-03-16&limit=1&page=2');
  assert.equal(res.status, 200);
  assert.equal(res.body.orders.length, 1);
  assert.equal(res.body.total, 2);
  assert.equal(res.body.page, 2);
});

test('GET /admin/orders/:id trae productos, historial y los estados permitidos', async () => {
  const perfume = await insertProduct(created.products, { price: 120, stock: 5 });
  const orderId = await comprar(perfume, 2);

  const res = await api('GET', `/admin/orders/${orderId}`, { token: adminToken });
  assert.equal(res.status, 200);
  const { order } = res.body;
  assert.equal(order.status, 'pagado');
  assert.equal(order.total, 240);
  assert.deepEqual(order.items.map((i) => [i.product_id, i.quantity, i.unit_price, i.subtotal]), [[perfume.id, 2, 120, 240]]);
  assert.deepEqual(order.history.map((h) => h.to_status), ['pagado']);
  assert.deepEqual(order.allowedNextStatuses, ['en_preparacion', 'cancelado']);

  assert.equal((await api('GET', '/admin/orders/99999999', { token: adminToken })).status, 404);
  assert.equal((await api('GET', `/admin/orders/${orderId}`, { token: client.token })).status, 403);
});

// ── SFTWRKEY-420: el cliente ve el estado y el historial de sus pedidos ─────

test('cuando el admin cambia el estado, el cliente lo ve con su historial al volver a pedir sus pedidos', async () => {
  const perfume = await insertProduct(created.products, { price: 80, stock: 5 });
  const orderId = await comprar(perfume, 1);
  assert.equal((await cambiarEstado(orderId, 'en_preparacion')).status, 200);

  const res = await api('GET', `/user/${client.id}/orders`, { token: client.token });
  assert.equal(res.status, 200);
  const pedido = res.body.orders.find((o) => o.id === orderId);
  assert.equal(pedido.status, 'en_preparacion');
  assert.deepEqual(pedido.history.map((h) => [h.from_status, h.to_status]), [[null, 'pagado'], ['pagado', 'en_preparacion']]);
  assert.deepEqual(pedido.items.map((i) => [i.product_id, i.quantity]), [[perfume.id, 1]]);
});

test('un cliente no puede ver los pedidos de otro cliente', async () => {
  const otro = await registerClient(created.users);
  const res = await api('GET', `/user/${client.id}/orders`, { token: otro.token });
  assert.equal(res.status, 403);
});
