// Integración: consola del admin (resumen, inventario con filtros, stock rápido, clientes) y borrar cuentas.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, api, registerClient, insertProduct, cleanup, pool, loginAdmin, buyWithAccount,
} from './helpers.js';

const created = { users: [], products: [] };
let admin;
let cliente;
const marca = `Marca Consola ${Date.now()}`;

before(async () => {
  await startServer();
  admin = await loginAdmin();
  cliente = await registerClient(created.users);
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

const conMarca = async (overrides) => {
  const p = await insertProduct(created.products, overrides);
  await pool.query('UPDATE products SET brand = $1 WHERE id = $2', [marca, p.id]);
  return p;
};

test('solo el admin entra a la consola', async () => {
  for (const ruta of ['/admin/summary', '/admin/products', '/admin/users']) {
    assert.equal((await api('GET', ruta, { token: cliente.token })).status, 403, ruta);
    assert.equal((await api('GET', ruta)).status, 401, ruta);
  }
  const resumen = await api('GET', '/admin/summary', { token: admin });
  assert.equal(resumen.status, 200);
  assert.equal(typeof resumen.body.productos.agotados, 'number');
  assert.equal(typeof resumen.body.pedidos.por_preparar, 'number');
});

test('el inventario filtra por stock y cuenta cada grupo', async () => {
  const agotado = await conMarca({ stock: 0 });
  const bajo = await conMarca({ stock: 1 });
  const disponible = await conMarca({ stock: 40 });
  const filtrar = (qs) => api('GET', `/admin/products?brand=${encodeURIComponent(marca)}${qs}`, { token: admin });

  const todos = await filtrar('');
  assert.deepEqual(todos.body.counts, { todos: 3, agotado: 1, bajo: 1, disponible: 1 });

  const soloAgotados = await filtrar('&stock=agotado');
  assert.deepEqual(soloAgotados.body.items.map((p) => p.id), [agotado.id]);
  assert.equal(soloAgotados.body.total, 1);
  // los contadores no cambian con el filtro de stock: sirven para las pestañas
  assert.equal(soloAgotados.body.counts.todos, 3);

  assert.deepEqual((await filtrar('&stock=bajo')).body.items.map((p) => p.id), [bajo.id]);
  assert.deepEqual((await filtrar('&sort=stock_desc')).body.items.map((p) => p.id), [disponible.id, bajo.id, agotado.id]);

  const busqueda = await api('GET', `/admin/products?q=${encodeURIComponent(bajo.name)}`, { token: admin });
  assert.deepEqual(busqueda.body.items.map((p) => p.id), [bajo.id]);
  // un filtro inválido se ignora en vez de romper la consulta
  assert.equal((await filtrar('&stock=x;DROP&sort=nada&pageSize=9999')).status, 200);
});

test('el stock se cambia desde la tabla y valida el número', async () => {
  const p = await conMarca({ stock: 0 });
  const mal = await api('PATCH', `/admin/products/${p.id}/stock`, { token: admin, body: { stock: -1 } });
  assert.equal(mal.status, 400);
  const bien = await api('PATCH', `/admin/products/${p.id}/stock`, { token: admin, body: { stock: 7 } });
  assert.equal(bien.status, 200);
  assert.equal(bien.body.antes, 0);
  assert.equal((await pool.query('SELECT stock FROM products WHERE id = $1', [p.id])).rows[0].stock, 7);
  assert.equal((await api('PATCH', `/admin/products/${p.id}/stock`, { token: cliente.token, body: { stock: 1 } })).status, 403);
});

test('la lista de clientes busca por nombre o correo', async () => {
  const res = await api('GET', `/admin/users?q=${encodeURIComponent(cliente.email)}`, { token: admin });
  assert.equal(res.status, 200);
  assert.equal(res.body.users.length, 1);
  assert.equal(res.body.users[0].role, 'CLIENTE');
});

test('una cuenta de admin nunca se borra, ni por el admin ni por sí misma', async () => {
  const adminId = (await pool.query(`SELECT id FROM users WHERE email = $1`, [process.env.ADMIN_EMAIL])).rows[0].id;
  assert.equal((await api('DELETE', `/admin/users/${adminId}`, { token: admin })).status, 403);
  assert.equal((await api('DELETE', '/me', { token: admin, body: { password: process.env.ADMIN_PASSWORD } })).status, 403);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [adminId])).rows[0].n, 1);
});

test('el cliente borra su cuenta con su contraseña y sus pedidos quedan para los reportes', async () => {
  const otro = await registerClient(created.users);
  const p = await conMarca({ stock: 5 });
  const compra = await buyWithAccount(otro, [{ product_id: p.id, quantity: 1 }]);
  const orderId = compra.body.order.id;

  const sinClave = await api('DELETE', '/me', { token: otro.token, body: { password: 'no-es-la-clave' } });
  assert.equal(sinClave.status, 401);

  const borrar = await api('DELETE', '/me', { token: otro.token, body: { password: otro.password } });
  assert.equal(borrar.status, 200);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [otro.id])).rows[0].n, 0);

  const pedido = (await pool.query('SELECT user_id, cuenta_eliminada FROM orders WHERE id = $1', [orderId])).rows[0];
  assert.equal(pedido.user_id, null);
  assert.equal(pedido.cuenta_eliminada, true);
  const lista = await api('GET', '/admin/orders?limit=50', { token: admin });
  const enLista = lista.body.orders.find((o) => o.id === orderId);
  assert.equal(enLista.customer_name, 'Cuenta eliminada');
  // limpieza del pedido (ya no tiene cuenta, cleanup no lo encuentra)
  await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]).catch(() => {});
  await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
});

test('el admin borra la cuenta de un cliente desde la consola', async () => {
  const otro = await registerClient(created.users);
  const res = await api('DELETE', `/admin/users/${otro.id}`, { token: admin });
  assert.equal(res.status, 200);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE id = $1', [otro.id])).rows[0].n, 0);
  // la sesión de una cuenta borrada ya no sirve
  assert.equal((await api('GET', '/me', { token: otro.token })).status, 401);
  assert.equal((await api('DELETE', `/admin/users/${otro.id}`, { token: admin })).status, 404);
});
