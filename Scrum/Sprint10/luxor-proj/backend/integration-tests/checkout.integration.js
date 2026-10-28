// Integración SFTWRKEY-445: pago con la página de Recurrente (simulado en helpers.js) contra
// PostgreSQL real. El stock se aparta al abrir el pago y el pedido solo nace cuando Recurrente
// confirma el cobro.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  startServer, stopServer, api, apiUrl, registerClient, insertProduct, productStock, cleanup, pool,
  fakeGateway, buyWithAccount, addressPayload, loginAdmin,
} from './helpers.js';
import { sweepExpiredSessions } from '../services/checkoutSessions.js';

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

const abrirPago = async (perfume, quantity) => {
  await api('POST', `/cart/${client.id}`, { token: client.token, body: [{ product_id: perfume.id, quantity }] });
  return api('POST', `/checkout/${client.id}`, { token: client.token, body: addressPayload });
};
const confirmar = (reference) => api('POST', '/checkout/confirm', { body: { reference } });
const ordenesDelCliente = async () =>
  (await pool.query('SELECT COUNT(*)::int AS n FROM orders WHERE user_id = $1', [client.id])).rows[0].n;

test('abrir el pago aparta el stock, devuelve el enlace de Recurrente y todavía no crea el pedido', async () => {
  const perfume = await insertProduct(created.products, { price: 150, stock: 5 });
  const ordenesAntes = await ordenesDelCliente();

  const res = await abrirPago(perfume, 2);

  assert.equal(res.status, 201);
  assert.match(res.body.checkoutUrl, /^https:\/\/recurrente\.test\/checkout-session\//);
  assert.equal(res.body.total, 335, 'Q300 en productos + Q35 de envío (SFTWRKEY-449)');
  assert.equal(await productStock(perfume.id), 3, 'las 2 unidades quedan apartadas');
  assert.equal(await ordenesDelCliente(), ordenesAntes, 'sin pago confirmado no hay pedido');

  // a Recurrente le llega el total calculado en el servidor y las rutas de vuelta a la tienda
  const enviado = await fakeGateway.request(res.body.reference);
  assert.deepEqual(enviado.items, [
    { product_id: perfume.id, name: perfume.name, quantity: 2, price: 150 },
    { name: 'Envío a domicilio', quantity: 1, price: 35 },
  ]);
  assert.match(enviado.successUrl, new RegExp(`/pago/resultado\\?ref=${res.body.reference}$`));
  assert.match(enviado.cancelUrl, new RegExp(`/pago/cancelado\\?ref=${res.body.reference}$`));
});

test('pago aprobado: al volver se crea el pedido pagado con su pago y se vacía el carrito', async () => {
  const perfume = await insertProduct(created.products, { price: 150, stock: 5 });
  const abierto = await abrirPago(perfume, 2);
  await fakeGateway.pay(abierto.body.reference);

  const res = await confirmar(abierto.body.reference);

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'pagado');
  assert.equal(res.body.guest, false);
  assert.equal(res.body.order.total, 335);
  assert.equal(res.body.order.shipping, 35);
  assert.deepEqual(res.body.order.delivery, { method: 'envio', address: addressPayload });
  assert.deepEqual(res.body.payment, { brand: 'VISA', last4: '4242' });
  const orderId = res.body.order.id;

  const orden = await pool.query(
    'SELECT total, status, user_id, shipping_cost, delivery_method, delivery_address FROM orders WHERE id = $1',
    [orderId]
  );
  assert.deepEqual(orden.rows[0], {
    total: '335.00', status: 'pagado', user_id: client.id,
    shipping_cost: '35.00', delivery_method: 'envio', delivery_address: addressPayload,
  });
  const items = await pool.query('SELECT product_id, quantity, unit_price FROM order_items WHERE order_id = $1', [orderId]);
  assert.deepEqual(items.rows, [{ product_id: perfume.id, quantity: 2, unit_price: '150.00' }]);
  const pago = await pool.query('SELECT status, amount, card_brand, card_last4, gateway_reference FROM payments WHERE order_id = $1', [orderId]);
  assert.deepEqual(pago.rows, [{ status: 'aprobado', amount: '335.00', card_brand: 'VISA', card_last4: '4242', gateway_reference: pago.rows[0].gateway_reference }]);
  assert.match(pago.rows[0].gateway_reference, /^pa_ch_test_/);

  assert.equal(await productStock(perfume.id), 3, 'el stock apartado no se descuenta dos veces');
  const carrito = await api('GET', `/cart/${client.id}`, { token: client.token });
  assert.deepEqual(carrito.body, []);
});

test('recargar la página de resultado no crea otro pedido ni cobra otra vez', async () => {
  const perfume = await insertProduct(created.products, { stock: 5 });
  const abierto = await abrirPago(perfume, 1);
  await fakeGateway.pay(abierto.body.reference);

  const [a, b] = await Promise.all([confirmar(abierto.body.reference), confirmar(abierto.body.reference)]);
  const c = await confirmar(abierto.body.reference);

  assert.equal(a.body.order.id, b.body.order.id);
  assert.equal(a.body.order.id, c.body.order.id);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM payments WHERE order_id = $1`, [a.body.order.id]);
  assert.equal(rows[0].n, 1);
});

test('pago rechazado y el cliente se sale: no hay pedido, el stock regresa y queda el motivo', async () => {
  const perfume = await insertProduct(created.products, { stock: 4 });
  const ordenesAntes = await ordenesDelCliente();
  const abierto = await abrirPago(perfume, 3);
  await fakeGateway.decline(abierto.body.reference, 'Fondos insuficientes');

  // mientras no se pague, volver a la tienda solo dice que sigue pendiente
  const pendiente = await confirmar(abierto.body.reference);
  assert.equal(pendiente.body.status, 'pendiente');
  assert.equal(pendiente.body.failureReason, 'Fondos insuficientes');

  const res = await api('POST', '/checkout/cancel', { body: { reference: abierto.body.reference } });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'cancelado');
  assert.equal(res.body.failureReason, 'Fondos insuficientes');
  assert.equal(await productStock(perfume.id), 4, 'el stock apartado regresa');
  assert.equal(await ordenesDelCliente(), ordenesAntes, 'no se crea el pedido');
  const pago = await pool.query(
    `SELECT status, order_id, decline_message FROM payments WHERE gateway_reference = (
       SELECT gateway_checkout_id FROM checkout_sessions WHERE id = $1)`,
    [abierto.body.reference]
  );
  assert.deepEqual(pago.rows, [{ status: 'rechazado', order_id: null, decline_message: 'Fondos insuficientes' }]);

  // cancelar otra vez no devuelve el stock dos veces
  await api('POST', '/checkout/cancel', { body: { reference: abierto.body.reference } });
  assert.equal(await productStock(perfume.id), 4);
});

test('si el cliente sí pagó pero vuelve por la ruta de cancelar, se crea el pedido igual', async () => {
  const perfume = await insertProduct(created.products, { stock: 2 });
  const abierto = await abrirPago(perfume, 1);
  await fakeGateway.pay(abierto.body.reference);

  const res = await api('POST', '/checkout/cancel', { body: { reference: abierto.body.reference } });

  assert.equal(res.body.status, 'pagado');
  assert.equal(await productStock(perfume.id), 1);
});

test('un pago en proceso no se cancela', async () => {
  const perfume = await insertProduct(created.products, { stock: 2 });
  const abierto = await abrirPago(perfume, 1);
  await fakeGateway.inProgress(abierto.body.reference);

  const res = await api('POST', '/checkout/cancel', { body: { reference: abierto.body.reference } });

  assert.equal(res.body.status, 'pendiente');
  assert.equal(await productStock(perfume.id), 1, 'el stock sigue apartado');
});

test('abrir un segundo pago libera el que quedó a medias', async () => {
  const perfume = await insertProduct(created.products, { stock: 3 });
  const primero = await abrirPago(perfume, 2);
  const segundo = await abrirPago(perfume, 2);

  assert.equal(segundo.status, 201);
  assert.notEqual(primero.body.reference, segundo.body.reference);
  assert.equal(await productStock(perfume.id), 1, 'solo el último pago aparta stock');
  const { rows } = await pool.query('SELECT status FROM checkout_sessions WHERE id = $1', [primero.body.reference]);
  assert.equal(rows[0].status, 'cancelado');
});

test('barrido de pagos vencidos: devuelve el stock de los abandonados y crea el pedido de los pagados', async () => {
  const abandonado = await insertProduct(created.products, { stock: 3 });
  const pagado = await insertProduct(created.products, { stock: 3 });
  const otro = await registerClient(created.users);

  const a = await abrirPago(abandonado, 2);
  await api('POST', `/cart/${otro.id}`, { token: otro.token, body: [{ product_id: pagado.id, quantity: 1 }] });
  const b = await api('POST', `/checkout/${otro.id}`, { token: otro.token, body: addressPayload });
  await fakeGateway.expire(a.body.reference);
  await fakeGateway.pay(b.body.reference);
  // el cliente cerró la pestaña: las sesiones vencieron hace rato
  await pool.query(`UPDATE checkout_sessions SET expires_at = NOW() - interval '10 minutes' WHERE id = ANY($1::uuid[])`, [
    [a.body.reference, b.body.reference],
  ]);

  await sweepExpiredSessions();

  assert.equal(await productStock(abandonado.id), 3, 'el stock del pago abandonado regresa');
  const pedidos = await pool.query('SELECT status FROM orders WHERE user_id = $1', [otro.id]);
  assert.deepEqual(pedidos.rows, [{ status: 'pagado' }], 'el que pagó y cerró la pestaña sí tiene su pedido');
});

test('una referencia inválida o desconocida no revela nada', async () => {
  const invalida = await confirmar('no-es-un-uuid');
  assert.equal(invalida.status, 400);
  const desconocida = await confirmar('00000000-0000-4000-8000-000000000000');
  assert.equal(desconocida.status, 404);
});

test('compra como invitado: paga en Recurrente y el pedido queda con sus datos de envío', async () => {
  const perfume = await insertProduct(created.products, { price: 200, stock: 5 });
  const key = crypto.randomUUID();
  const cuerpo = {
    guest: { name: 'Invitada Prueba', email: 'Invitada@Prueba.com' },
    items: [{ product_id: perfume.id, quantity: 2 }],
    address: addressPayload,
    expectedCents: 40000,
  };
  const res = await guestCheckout(cuerpo, key);
  assert.equal(res.status, 201);
  assert.equal(await productStock(perfume.id), 3);

  // el mismo pedido reintentado reutiliza el pago abierto en vez de apartar otra vez
  const reintento = await guestCheckout(cuerpo, key);
  assert.equal(reintento.body.reference, res.body.reference);
  assert.equal(await productStock(perfume.id), 3);

  await fakeGateway.pay(res.body.reference);
  const confirmado = await confirmar(res.body.reference);

  assert.equal(confirmado.body.status, 'pagado');
  assert.equal(confirmado.body.guest, true);
  const recibo = await pool.query('SELECT guest_name, guest_email, address FROM guest_receipts WHERE order_id = $1', [
    confirmado.body.order.id,
  ]);
  assert.deepEqual(recibo.rows[0], {
    guest_name: 'Invitada Prueba',
    guest_email: 'invitada@prueba.com',
    address: { method: 'envio', address: addressPayload },
  });
  const pago = await pool.query('SELECT status, user_id FROM payments WHERE order_id = $1', [confirmado.body.order.id]);
  assert.deepEqual(pago.rows, [{ status: 'aprobado', user_id: null }]);
});

test('invitado: si el precio cambió responde 409 y no aparta stock', async () => {
  const perfume = await insertProduct(created.products, { price: 200, stock: 5 });
  const res = await guestCheckout(
    {
      guest: { name: 'Invitado', email: 'invitado@prueba.com' },
      items: [{ product_id: perfume.id, quantity: 1 }],
      address: addressPayload,
      expectedCents: 100,
    },
    crypto.randomUUID()
  );
  assert.equal(res.status, 409);
  assert.equal(await productStock(perfume.id), 5);
});

test('el cuerpo del checkout ya no acepta tarjetas: nunca se guardan ni se mandan a Recurrente', async () => {
  const perfume = await insertProduct(created.products, { stock: 2 });
  const res = await buyWithAccount(client, [{ product_id: perfume.id, quantity: 1 }], {
    ...addressPayload,
    cardNumber: '4242424242424242',
    cvv: '123',
  });
  assert.equal(res.body.status, 'pagado');

  const { rows } = await pool.query(
    `SELECT s.items::text || COALESCE(s.guest::text, '') AS sesion, p.* FROM checkout_sessions s
     JOIN payments p ON p.order_id = s.order_id WHERE s.order_id = $1`,
    [res.body.order.id]
  );
  assert.doesNotMatch(JSON.stringify(rows), /4242424242424242|"cvv"/);
});

// el checkout de invitado exige el origen de la tienda (CSRF) y la clave de idempotencia
async function guestCheckout(body, key) {
  const res = await fetch(apiUrl('/guest-checkout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      'Idempotency-Key': key,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ── SFTWRKEY-449: envío y forma de entrega ─────────────────────────────────

test('desde Q500 en productos el envío es gratis y no se agrega renglón en Recurrente', async () => {
  // cliente nuevo para esta sección: el checkout permite 10 intentos por minuto por usuario
  client = await registerClient(created.users);
  const perfume = await insertProduct(created.products, { price: 250, stock: 5 });
  const abierto = await abrirPago(perfume, 2);

  assert.equal(abierto.body.total, 500);
  const enviado = await fakeGateway.request(abierto.body.reference);
  assert.equal(enviado.items.length, 1);
});

test('recoger en tienda: sin costo de envío y el pedido guarda el local', async () => {
  const perfume = await insertProduct(created.products, { price: 120, stock: 5 });
  await api('POST', `/cart/${client.id}`, { token: client.token, body: [{ product_id: perfume.id, quantity: 1 }] });
  const abierto = await api('POST', `/checkout/${client.id}`, {
    token: client.token,
    body: { deliveryMethod: 'recoger', pickupStore: 'luxor' },
  });
  assert.equal(abierto.status, 201);
  assert.equal(abierto.body.total, 120);

  await fakeGateway.pay(abierto.body.reference);
  const res = await confirmar(abierto.body.reference);
  const orden = await pool.query('SELECT shipping_cost, delivery_method, delivery_address FROM orders WHERE id = $1', [res.body.order.id]);
  assert.deepEqual(orden.rows[0], {
    shipping_cost: '0.00',
    delivery_method: 'recoger',
    delivery_address: { id: 'luxor', name: 'Joyería Luxor', address: 'C.C. San Isidro, Zona 16' },
  });
});

test('un costo de envío enviado por el navegador se ignora', async () => {
  const perfume = await insertProduct(created.products, { price: 100, stock: 5 });
  await api('POST', `/cart/${client.id}`, { token: client.token, body: [{ product_id: perfume.id, quantity: 1 }] });
  const res = await api('POST', `/checkout/${client.id}`, {
    token: client.token,
    body: { ...addressPayload, shipping: 0, shippingCost: 0, total: 100 },
  });
  assert.equal(res.body.total, 135);
});

test('sin dirección (envío) o con un local que no existe responde 400 sin apartar stock', async () => {
  const perfume = await insertProduct(created.products, { price: 100, stock: 5 });
  await api('POST', `/cart/${client.id}`, { token: client.token, body: [{ product_id: perfume.id, quantity: 1 }] });

  const sinDireccion = await api('POST', `/checkout/${client.id}`, { token: client.token, body: {} });
  const otroLocal = await api('POST', `/checkout/${client.id}`, {
    token: client.token,
    body: { deliveryMethod: 'recoger', pickupStore: 'bodega-secreta' },
  });

  assert.equal(sinDireccion.status, 400);
  assert.equal(otroLocal.status, 400);
  assert.equal(await productStock(perfume.id), 5);
});

test('el cliente y el admin ven el envío y la dirección del pedido', async () => {
  const perfume = await insertProduct(created.products, { price: 150, stock: 5 });
  const compra = await buyWithAccount(client, [{ product_id: perfume.id, quantity: 1 }]);
  const orderId = compra.body.order.id;

  const historial = await api('GET', `/user/${client.id}/orders`, { token: client.token });
  const pedido = historial.body.orders.find((o) => o.id === orderId);
  assert.equal(pedido.shipping, 35);
  assert.deepEqual(pedido.delivery, { method: 'envio', address: addressPayload });

  const confirmacion = await api('GET', `/orders/${orderId}/confirmation`, { token: client.token });
  assert.equal(confirmacion.body.order.total, 185);
  assert.equal(confirmacion.body.order.shipping, 35);

  const adminToken = await loginAdmin();
  const detalle = await api('GET', `/admin/orders/${orderId}`, { token: adminToken });
  assert.equal(detalle.body.order.shipping, 35);
  assert.deepEqual(detalle.body.order.delivery, { method: 'envio', address: addressPayload });
});

test('invitado que recoge en tienda: no pide dirección y el admin ve el local', async () => {
  const perfume = await insertProduct(created.products, { price: 200, stock: 5 });
  const res = await guestCheckout(
    {
      guest: { name: 'Invitado Recoge', email: 'recoge@prueba.com' },
      items: [{ product_id: perfume.id, quantity: 1 }],
      address: { deliveryMethod: 'recoger', pickupStore: 'victoria' },
      expectedCents: 20000,
    },
    crypto.randomUUID()
  );
  assert.equal(res.status, 201);
  await fakeGateway.pay(res.body.reference);
  const confirmado = await confirmar(res.body.reference);
  assert.equal(confirmado.body.order.total, 200);
  assert.equal(confirmado.body.order.delivery.method, 'recoger');

  const adminToken = await loginAdmin();
  const detalle = await api('GET', `/admin/orders/${confirmado.body.order.id}`, { token: adminToken });
  assert.equal(detalle.body.order.delivery.store.name, 'Joyería Victoria');
});
