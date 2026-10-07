// Regresión R2 — Checkout sin sobreventa y con total calculado en el servidor.
// Comportamiento validado que se protege: no se vende más de lo que hay en stock,
// sí se puede comprar exactamente el stock disponible, y el total se calcula con el
// precio de la base aunque el cliente envíe otro monto.
// Cambio que lo rompería: invertir o relajar la comparación quantity > stock,
// quitar la condición "stock >= $1" del UPDATE o tomar el total desde el body.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, api, registerClient, insertProduct, productStock, cleanup, pool, cardPayload,
} from './helpers.js';

const created = { users: [], products: [] };
let client;

before(async () => {
  await startServer();
  client = await registerClient(created.users);
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

const comprar = async (productId, quantity, extraBody = {}) => {
  await api('POST', `/cart/${client.id}`, { token: client.token, body: [{ product_id: productId, quantity }] });
  return api('POST', `/checkout/${client.id}`, { token: client.token, body: { ...cardPayload(), ...extraBody } });
};

const ordenesDelCliente = async () =>
  (await pool.query('SELECT COUNT(*)::int AS n FROM orders WHERE user_id = $1', [client.id])).rows[0].n;

test('pedir más unidades que el stock responde 409 y no crea la orden', async () => {
  const perfume = await insertProduct(created.products, { stock: 2 });
  const ordenesAntes = await ordenesDelCliente();

  const res = await comprar(perfume.id, 3);

  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'INSUFFICIENT_STOCK');
  assert.deepEqual(res.body.items, [{ product_id: perfume.id, name: perfume.name, disponible: 2, solicitado: 3 }]);
  assert.equal(await productStock(perfume.id), 2, 'el stock no cambia');
  assert.equal(await ordenesDelCliente(), ordenesAntes, 'no se crea ninguna orden');
});

test('comprar exactamente el stock disponible sí se permite y deja el stock en 0', async () => {
  const perfume = await insertProduct(created.products, { stock: 3 });

  const res = await comprar(perfume.id, 3);

  assert.equal(res.status, 201);
  assert.equal(await productStock(perfume.id), 0);
});

test('el total se calcula con el precio de la base, no con el monto que envía el cliente', async () => {
  const perfume = await insertProduct(created.products, { price: 420, stock: 5 });

  const res = await comprar(perfume.id, 2, { total: 1, amount: 1, price: 1 });

  assert.equal(res.status, 201);
  assert.equal(res.body.order.total, 840);
  const { rows } = await pool.query('SELECT amount FROM payments WHERE order_id = $1', [res.body.order.id]);
  assert.equal(rows[0].amount, '840.00');
});
