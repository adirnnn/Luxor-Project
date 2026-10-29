// Integración (feedback del cliente): la portada muestra los más vendidos.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, api, insertProduct, cleanup, pool } from './helpers.js';

const created = { users: [], products: [] };
const ordenes = [];

before(startServer);
after(async () => {
  if (ordenes.length) await pool.query('DELETE FROM orders WHERE id = ANY($1::int[])', [ordenes]);
  await cleanup(created);
  await stopServer();
});

// pedido de invitado directo en la base con un perfume y sus unidades
async function venta(productId, quantity, status = 'pagado') {
  const { rows } = await pool.query(`INSERT INTO orders (user_id, total, status) VALUES (NULL, 100, $1) RETURNING id`, [status]);
  ordenes.push(rows[0].id);
  await pool.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, 100)', [rows[0].id, productId, quantity]);
}

test('ordena por unidades vendidas, sin contar pedidos cancelados, y filtra por categoría', async () => {
  // categoría 5 (Fresco) aislada con perfumes de prueba
  const poco = await insertProduct(created.products, { category_id: 5 });
  const mucho = await insertProduct(created.products, { category_id: 5 });
  const cancelado = await insertProduct(created.products, { category_id: 5 });
  await venta(poco.id, 3);
  await venta(mucho.id, 40);
  await venta(cancelado.id, 99, 'cancelado');

  const res = await api('GET', '/products/best-sellers?category=5');

  assert.equal(res.status, 200);
  assert.ok(res.body.length <= 8);
  assert.ok(res.body.every((p) => p.category_id === 5));
  const ids = res.body.map((p) => p.id);
  assert.ok(ids.indexOf(mucho.id) < ids.indexOf(poco.id), 'el que más vendió va primero');
  assert.ok(ids.indexOf(poco.id) < ids.indexOf(cancelado.id), 'las unidades de pedidos cancelados no cuentan');
  assert.equal(res.body.find((p) => p.id === mucho.id).sold, 40);
});

test('sin categoría devuelve como máximo 8 y una categoría inválida responde 400', async () => {
  const todos = await api('GET', '/products/best-sellers');
  assert.equal(todos.status, 200);
  assert.ok(todos.body.length > 0 && todos.body.length <= 8);

  const invalida = await api('GET', '/products/best-sellers?category=abc');
  assert.equal(invalida.status, 400);
});
