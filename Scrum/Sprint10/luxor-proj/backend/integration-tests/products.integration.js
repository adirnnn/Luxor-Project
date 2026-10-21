// Integración: CRUD de productos del administrador (auth + validación + Express) + PostgreSQL
// (tabla products con JOIN a categories).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, api, loginAdmin, cleanup, pool } from './helpers.js';

const productId = `it-crud-${Date.now()}`;
const created = { products: [productId] };
let adminToken;

before(async () => {
  await startServer();
  adminToken = await loginAdmin();
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

test('POST /products (ADMIN) inserta el perfume en la tabla products', async () => {
  const res = await api('POST', '/products', {
    token: adminToken,
    body: {
      id: productId,
      name: 'Perfume CRUD Integración',
      price: '250.50',
      stock: 7,
      category_id: 2,
      notes: { salida: 'Azafrán', corazon: 'Rosa', fondo: 'Oud' },
    },
  });
  assert.equal(res.status, 201);

  const { rows } = await pool.query('SELECT name, price, stock, salida, fondo FROM products WHERE id = $1', [productId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, '250.50');
  assert.equal(rows[0].stock, 7);
  assert.equal(rows[0].salida, 'Azafrán');
});

test('GET /products/:id devuelve la categoría (JOIN) y arma notes desde las columnas', async () => {
  const res = await api('GET', `/products/${productId}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.category_name, 'Oriental');
  assert.deepEqual(res.body.notes, { salida: 'Azafrán', corazon: 'Rosa', fondo: 'Oud' });
});

test('PUT /products/:id actualiza la fila en la base', async () => {
  const res = await api('PUT', `/products/${productId}`, {
    token: adminToken,
    body: { name: 'Perfume CRUD Editado', price: '199.99', stock: 3, category_id: 5, notes: { salida: 'Limón', corazon: 'Té', fondo: 'Cedro' } },
  });
  assert.equal(res.status, 200);

  const { rows } = await pool.query('SELECT name, price, stock, category_id FROM products WHERE id = $1', [productId]);
  assert.deepEqual(rows[0], { name: 'Perfume CRUD Editado', price: '199.99', stock: 3, category_id: 5 });

  const detalle = await api('GET', `/products/${productId}`);
  assert.equal(detalle.body.category_name, 'Fresco');
});

test('DELETE /products/:id elimina la fila y luego GET responde 404', async () => {
  const res = await api('DELETE', `/products/${productId}`, { token: adminToken });
  assert.equal(res.status, 200);

  const { rows } = await pool.query('SELECT 1 FROM products WHERE id = $1', [productId]);
  assert.equal(rows.length, 0);

  const detalle = await api('GET', `/products/${productId}`);
  assert.equal(detalle.status, 404);
});
