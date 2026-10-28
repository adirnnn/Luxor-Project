// SFTWRKEY-421: GET /orders/:id/confirmation solo muestra pedidos del usuario que inició sesión
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderConfirmationHandler } from './services/orderConfirmation.js';

// pedido 7 del usuario 1; cualquier otro usuario no lo encuentra
function fakePool() {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/FROM orders/.test(sql)) {
        const [id, userId] = params;
        return { rows: id === 7 && userId === 1 ? [{ id: 7, total: '780.00', status: 'pagado', created_at: '2026-10-27' }] : [] };
      }
      if (/FROM order_items/.test(sql)) return { rows: [{ product_id: 'yara', name: 'Lattafa Yara', quantity: 2, unit_price: '390.00' }] };
      if (/FROM payments/.test(sql)) return { rows: [{ card_brand: 'VISA', card_last4: '1111' }] };
      return { rows: [] };
    },
  };
}

const mockRes = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  set(k, v) { this.headers[k] = v; return this; },
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const pedir = async (id, userId, pool = fakePool()) => {
  const res = mockRes();
  await createOrderConfirmationHandler({ pool })({ params: { id }, user: { id: userId } }, res);
  return { res, pool };
};

test('el dueño ve su pedido con productos, total y pago, sin caché', async () => {
  const { res } = await pedir('7', 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.order.total, 780);
  assert.equal(res.body.order.items[0].subtotal, 780);
  assert.deepEqual(res.body.payment, { brand: 'VISA', last4: '1111' });
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('otro usuario que cambia el número en la URL recibe 404 sin datos del pedido', async () => {
  const { res, pool } = await pedir('7', 2);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.order, undefined);
  // la consulta filtra por el usuario de la sesión, no solo por el número
  assert.deepEqual(pool.calls[0].params, [7, 2]);
  assert.equal(pool.calls.length, 1, 'no consulta productos ni pagos de un pedido ajeno');
});

test('un id que no es un número positivo responde 400 sin tocar la base', async () => {
  for (const id of ['abc', '0', '-1', '7 OR 1=1']) {
    const { res, pool } = await pedir(id, 1);
    assert.equal(res.statusCode, 400);
    assert.equal(pool.calls.length, 0);
  }
});
