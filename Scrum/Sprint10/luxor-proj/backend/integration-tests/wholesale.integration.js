// Integración (feedback del cliente): rol Mayorista con un porcentaje que define el admin.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, api, registerClient, insertProduct, cleanup, pool, loginAdmin, login,
  fakeGateway, addressPayload,
} from './helpers.js';

const created = { users: [], products: [] };
let admin;
let cliente;

before(async () => {
  await startServer();
  admin = await loginAdmin();
  cliente = await registerClient(created.users);
});
after(async () => {
  await api('PUT', '/admin/wholesale', { token: admin, body: { percent: 10 } });
  await cleanup(created);
  await stopServer();
});

const abrirPago = async (usuario, perfume, quantity, extra = {}) => {
  await api('POST', `/cart/${usuario.id}`, { token: usuario.token, body: [{ product_id: perfume.id, quantity }] });
  return api('POST', `/checkout/${usuario.id}`, { token: usuario.token, body: { ...addressPayload, ...extra } });
};

test('solo el admin cambia el porcentaje y los roles', async () => {
  const porcentaje = await api('PUT', '/admin/wholesale', { token: cliente.token, body: { percent: 90 } });
  const rol = await api('PATCH', `/admin/users/${cliente.id}/role`, { token: cliente.token, body: { role: 'MAYORISTA' } });
  assert.equal(porcentaje.status, 403);
  assert.equal(rol.status, 403);

  const fueraDeRango = await api('PUT', '/admin/wholesale', { token: admin, body: { percent: 80 } });
  assert.equal(fueraDeRango.status, 400);
});

test('el admin hace mayorista a un cliente y su compra sale con el porcentaje, calculado en el servidor', async () => {
  assert.equal((await api('PUT', '/admin/wholesale', { token: admin, body: { percent: 20 } })).status, 200);
  const busqueda = await api('GET', `/admin/customers?q=${encodeURIComponent(cliente.email)}`, { token: admin });
  assert.deepEqual(busqueda.body.customers.map((c) => c.id), [cliente.id]);

  const cambio = await api('PATCH', `/admin/users/${cliente.id}/role`, { token: admin, body: { role: 'MAYORISTA' } });
  assert.equal(cambio.status, 200);

  // la sesión que ya tenía abierta ve su porcentaje sin volver a entrar
  const yo = await api('GET', '/me', { token: cliente.token });
  assert.equal(yo.body.user.role, 'MAYORISTA');
  assert.equal(yo.body.user.wholesalePercent, 20);

  // Q500 en productos: 20 % menos = Q400, y como baja de Q500 se cobra el envío de Q35
  const perfume = await insertProduct(created.products, { price: 250, stock: 5 });
  const abierto = await abrirPago(cliente, perfume, 2, { discount: 999, total: 1 });
  assert.equal(abierto.status, 201);
  assert.equal(abierto.body.total, 435);
  const enviado = await fakeGateway.request(abierto.body.reference);
  assert.deepEqual(enviado.items, [{ name: 'Compra Perfumería Victoria · precio mayorista · envío incluido', quantity: 1, price: 435 }]);

  await fakeGateway.pay(abierto.body.reference);
  const confirmado = await api('POST', '/checkout/confirm', { body: { reference: abierto.body.reference } });
  const orden = await pool.query('SELECT total, discount, coupon_code FROM orders WHERE id = $1', [confirmado.body.order.id]);
  assert.deepEqual(orden.rows[0], { total: '435.00', discount: '100.00', coupon_code: 'Mayorista 20%' });

  const historial = await api('GET', `/user/${cliente.id}/orders`, { token: cliente.token });
  const pedido = historial.body.orders.find((o) => o.id === confirmado.body.order.id);
  assert.equal(pedido.discount, 100);
  assert.equal(pedido.discount_label, 'Mayorista 20%');
});

test('un mayorista no puede combinar un cupón con su precio', async () => {
  const perfume = await insertProduct(created.products, { price: 250, stock: 5 });
  const res = await abrirPago(cliente, perfume, 1, { couponCode: 'VERANO10' });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'COUPON_NOT_FOR_WHOLESALE');
});

test('al quitarle el rol, su siguiente compra ya no lleva descuento', async () => {
  await api('PATCH', `/admin/users/${cliente.id}/role`, { token: admin, body: { role: 'CLIENTE' } });
  const perfume = await insertProduct(created.products, { price: 250, stock: 5 });
  const abierto = await abrirPago(cliente, perfume, 2);
  assert.equal(abierto.body.total, 500);
  await api('POST', '/checkout/cancel', { body: { reference: abierto.body.reference } });
});

test('desde aquí nunca se cambia el rol de un administrador', async () => {
  const { user } = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const res = await api('PATCH', `/admin/users/${user.id}/role`, { token: admin, body: { role: 'MAYORISTA' } });
  assert.equal(res.status, 404);
  const yo = await api('GET', '/me', { token: admin });
  assert.equal(yo.body.user.role, 'ADMIN');
});
