// SFTWRKEY-449: regla de envío y forma de entrega
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shippingCents, parseDelivery, deliveryView, PICKUP_STORES } from './shipping.js';

const direccion = { billingAddress: 'Zona 10, 5a avenida', city: 'Guatemala', postalCode: '01010', country: 'Guatemala' };

test('envío a domicilio: Q35 por debajo de Q500 y gratis desde Q500 exactos', () => {
  assert.equal(shippingCents(22800, 'envio'), 3500);
  assert.equal(shippingCents(49999, 'envio'), 3500);
  assert.equal(shippingCents(50000, 'envio'), 0);
  assert.equal(shippingCents(120000, 'envio'), 0);
});

test('recoger en tienda nunca cobra envío', () => {
  assert.equal(shippingCents(22800, 'recoger'), 0);
});

test('envío a domicilio exige la dirección completa', () => {
  assert.deepEqual(parseDelivery({ deliveryMethod: 'envio', ...direccion }), { method: 'envio', address: direccion });
  // sin deliveryMethod se toma como envío
  assert.equal(parseDelivery(direccion).method, 'envio');
  assert.throws(() => parseDelivery({ deliveryMethod: 'envio', ...direccion, city: '' }), { status: 400 });
});

test('recoger en tienda exige uno de los 3 locales y no pide dirección', () => {
  assert.deepEqual(parseDelivery({ deliveryMethod: 'recoger', pickupStore: 'glamour' }), {
    method: 'recoger',
    store: PICKUP_STORES.find((s) => s.id === 'glamour'),
  });
  assert.throws(() => parseDelivery({ deliveryMethod: 'recoger', pickupStore: 'otro-local' }), { status: 400 });
  assert.throws(() => parseDelivery({ deliveryMethod: 'dron' }), { status: 400 });
});

test('el costo de envío que mande el navegador se ignora: parseDelivery no lo lee', () => {
  const entrega = parseDelivery({ ...direccion, shipping: 0, shippingCost: -100 });
  assert.equal('shipping' in entrega, false);
  assert.equal(shippingCents(10000, entrega.method), 3500);
});

test('deliveryView: pedidos nuevos, pedidos de invitado anteriores y pedidos sin datos', () => {
  assert.deepEqual(deliveryView({ delivery_method: 'envio', delivery_address: direccion }), { method: 'envio', address: direccion });
  assert.deepEqual(deliveryView({ delivery_method: 'recoger', delivery_address: PICKUP_STORES[0] }), {
    method: 'recoger',
    store: PICKUP_STORES[0],
  });
  assert.deepEqual(deliveryView({ delivery_method: null, delivery_address: null, guestAddress: direccion }), {
    method: 'envio',
    address: direccion,
  });
  assert.equal(deliveryView({ delivery_method: null, delivery_address: null }), null);
});
