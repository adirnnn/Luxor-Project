// SFTWRKEY-445: cliente de Recurrente. Nunca llama a la API real: fetch es un doble.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateway, buildCheckoutItems, toCheckoutResult, PaymentGatewayError } from './paymentGateway.js';

const env = { RECURRENTE_SECRET_KEY: 'sk_test_unitarias' };

const fakeFetch = (status, body) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: status < 400, status, json: async () => body };
  };
  return { calls, fetchImpl };
};

const pedido = {
  reference: '11111111-2222-4333-8444-555555555555',
  items: [{ product_id: 'khamrah', name: 'Lattafa Khamrah', quantity: 2, price: 390 }],
  successUrl: 'https://tienda.test/pago/resultado?ref=1',
  cancelUrl: 'https://tienda.test/pago/cancelado?ref=1',
  expiresAt: new Date('2026-10-28T12:30:00Z'),
};

test('crear checkout: manda productos en centavos, rutas de vuelta y la llave secreta en el header', async () => {
  const { calls, fetchImpl } = fakeFetch(201, { id: 'ch_abc', status: 'unpaid', checkout_url: 'https://app.recurrente.com/checkout-session/ch_abc' });

  const result = await gateway.createCheckout(pedido, { env, fetchImpl });

  assert.equal(result.id, 'ch_abc');
  assert.equal(result.url, 'https://app.recurrente.com/checkout-session/ch_abc');
  assert.equal(calls[0].url, 'https://app.recurrente.com/api/checkouts');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['X-SECRET-KEY'], 'sk_test_unitarias');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    items: [{ name: 'Lattafa Khamrah', amount_in_cents: 39000, currency: 'GTQ', quantity: 2 }],
    success_url: pedido.successUrl,
    cancel_url: pedido.cancelUrl,
    expires_at: '2026-10-28T12:30:00.000Z',
    metadata: { referencia: pedido.reference },
  });
});

test('más de 9 unidades del mismo perfume se parten en renglones (límite de Recurrente)', () => {
  const lines = buildCheckoutItems([{ name: 'Yara', quantity: 20, price: 520 }]);
  assert.deepEqual(lines.map((l) => l.quantity), [9, 9, 2]);
  assert.ok(lines.every((l) => l.amount_in_cents === 52000));
});

test('leer checkout pagado: solo se toman la marca y los últimos 4 dígitos', async () => {
  const { calls, fetchImpl } = fakeFetch(200, {
    id: 'ch_abc',
    status: 'paid',
    payment: { id: 'pa_123' },
    payment_method: { type: 'card', card: { last4: '4242', network: 'visa', expiration_month: 12 } },
  });

  const result = await gateway.getCheckout('ch_abc', { env, fetchImpl });

  assert.equal(calls[0].url, 'https://app.recurrente.com/api/checkouts/ch_abc');
  assert.deepEqual(result, {
    id: 'ch_abc', url: null, status: 'paid', paymentId: 'pa_123', brand: 'VISA', last4: '4242', failureReason: null,
  });
});

test('un rechazo trae el motivo que dio Recurrente', () => {
  const result = toCheckoutResult({ id: 'ch_x', status: 'unpaid', latest_intent: { details: { failure_reason: 'Fondos insuficientes' } } });
  assert.equal(result.failureReason, 'Fondos insuficientes');
  assert.equal(result.last4, null);
});

test('sin RECURRENTE_SECRET_KEY no llama a nadie y avisa que no está configurada', async () => {
  const { calls, fetchImpl } = fakeFetch(201, {});
  await assert.rejects(gateway.createCheckout(pedido, { env: {}, fetchImpl }), (err) => {
    assert.ok(err instanceof PaymentGatewayError);
    assert.equal(err.code, 'GATEWAY_NOT_CONFIGURED');
    return true;
  });
  assert.equal(calls.length, 0);
});

test('un error de Recurrente o de red se convierte en PaymentGatewayError', async () => {
  const caido = fakeFetch(500, { message: 'error interno' });
  await assert.rejects(gateway.getCheckout('ch_abc', { env, fetchImpl: caido.fetchImpl }), PaymentGatewayError);

  const sinRed = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(gateway.getCheckout('ch_abc', { env, fetchImpl: sinRed }), PaymentGatewayError);
});

test('RECURRENTE_API_URL (Recurrente simulado de las pruebas) se ignora en producción', async () => {
  const body = { id: 'ch_abc', status: 'unpaid' };
  const pruebas = fakeFetch(200, body);
  await gateway.getCheckout('ch_abc', { env: { ...env, RECURRENTE_API_URL: 'http://localhost:3200/api' }, fetchImpl: pruebas.fetchImpl });
  assert.equal(pruebas.calls[0].url, 'http://localhost:3200/api/checkouts/ch_abc');

  const produccion = fakeFetch(200, body);
  await gateway.getCheckout('ch_abc', {
    env: { ...env, NODE_ENV: 'production', RECURRENTE_API_URL: 'http://evil.test/api' },
    fetchImpl: produccion.fetchImpl,
  });
  assert.equal(produccion.calls[0].url, 'https://app.recurrente.com/api/checkouts/ch_abc');
});
