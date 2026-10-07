// Integración: checkout = rutas + carrito en PostgreSQL + servicio de pasarela de pago
// + transacción que descuenta stock y registra orders, order_items y payments.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, api, registerClient, insertProduct, productStock, cleanup, pool,
  cardPayload, APPROVED_CARD, DECLINED_CARD,
} from './helpers.js';

const created = { users: [], products: [] };
let client;
let perfume;

before(async () => {
  await startServer();
  client = await registerClient(created.users);
  perfume = await insertProduct(created.products, { price: 150, stock: 5 });
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

const llenarCarrito = (quantity) =>
  api('POST', `/cart/${client.id}`, { token: client.token, body: [{ product_id: perfume.id, quantity }] });

test('pago rechazado: responde 402, registra el intento y no toca stock ni carrito', async () => {
  await llenarCarrito(2);

  const res = await api('POST', `/checkout/${client.id}`, { token: client.token, body: cardPayload(DECLINED_CARD) });

  assert.equal(res.status, 402);
  assert.equal(res.body.code, 'CARD_DECLINED');
  assert.equal(res.body.declineCode, 'FONDOS_INSUFICIENTES');

  const pagos = await pool.query('SELECT status, order_id FROM payments WHERE user_id = $1', [client.id]);
  assert.deepEqual(pagos.rows, [{ status: 'rechazado', order_id: null }]);
  assert.equal(await productStock(perfume.id), 5, 'el stock no cambia');

  const carrito = await api('GET', `/cart/${client.id}`, { token: client.token });
  assert.deepEqual(carrito.body, [{ product_id: perfume.id, quantity: 2 }], 'el carrito se conserva');
});

test('pago aprobado: crea orden, items y pago, descuenta stock y vacía el carrito', async () => {
  await llenarCarrito(2);

  const res = await api('POST', `/checkout/${client.id}`, { token: client.token, body: cardPayload(APPROVED_CARD) });

  assert.equal(res.status, 201);
  assert.equal(res.body.order.total, 300);
  assert.equal(res.body.payment.status, 'aprobado');
  assert.equal(res.body.payment.last4, '4242');
  const orderId = res.body.order.id;

  const orden = await pool.query('SELECT total, status FROM orders WHERE id = $1', [orderId]);
  assert.deepEqual(orden.rows[0], { total: '300.00', status: 'completed' });

  const items = await pool.query('SELECT product_id, quantity, unit_price FROM order_items WHERE order_id = $1', [orderId]);
  assert.deepEqual(items.rows, [{ product_id: perfume.id, quantity: 2, unit_price: '150.00' }]);

  const pago = await pool.query('SELECT status, card_last4 FROM payments WHERE order_id = $1', [orderId]);
  assert.deepEqual(pago.rows, [{ status: 'aprobado', card_last4: '4242' }]);

  assert.equal(await productStock(perfume.id), 3, 'se descuentan las 2 unidades');

  const carrito = await api('GET', `/cart/${client.id}`, { token: client.token });
  assert.deepEqual(carrito.body, []);
});

test('la orden aparece en el historial GET /user/:id/orders', async () => {
  const res = await api('GET', `/user/${client.id}/orders`, { token: client.token });

  assert.equal(res.status, 200);
  assert.equal(res.body.orders.length, 1);
  assert.equal(res.body.orders[0].items[0].product_id, perfume.id);
  assert.equal(res.body.orders[0].items[0].name, perfume.name);
});
