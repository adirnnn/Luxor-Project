// SFTWRKEY-410: bloqueo por pagos rechazados (services/declineGuard.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDeclineGuard } from './declineGuard.js';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

// true si el middleware deja pasar la petición
const pasa = (guard, req) => {
  let next = false;
  guard.check(req, mockRes(), () => { next = true; });
  return next;
};

test('declineGuard: bloquea al llegar a 3 rechazos y avisa una sola vez', () => {
  const bloqueos = [];
  const guard = createDeclineGuard({ max: 3, windowMs: 60_000, onBlock: (req) => bloqueos.push(req.ip) });
  const req = { ip: '203.0.113.1' };

  guard.recordDecline(req);
  guard.recordDecline(req);
  assert.equal(pasa(guard, req), true, 'con 2 rechazos todavía puede pagar');

  guard.recordDecline(req);
  const res = mockRes();
  let next = false;
  guard.check(req, res, () => { next = true; });
  assert.equal(next, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.success, false);

  guard.recordDecline(req);
  assert.deepEqual(bloqueos, ['203.0.113.1'], 'onBlock se llama una sola vez');
  assert.equal(pasa(guard, { ip: '198.51.100.1' }), true, 'otra IP no se ve afectada');
});

test('declineGuard: el bloqueo vence cuando pasa la ventana', async () => {
  const guard = createDeclineGuard({ max: 1, windowMs: 20 });
  const req = { ip: '203.0.113.2' };

  guard.recordDecline(req);
  assert.equal(pasa(guard, req), false);

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(pasa(guard, req), true);
});

test('declineGuard: los rechazos viejos (fuera de la ventana) no se acumulan', async () => {
  const guard = createDeclineGuard({ max: 2, windowMs: 20 });
  const req = { ip: '203.0.113.3' };

  guard.recordDecline(req);
  await new Promise((resolve) => setTimeout(resolve, 30));
  guard.recordDecline(req);
  assert.equal(pasa(guard, req), true, 'el primer rechazo ya venció');
});
