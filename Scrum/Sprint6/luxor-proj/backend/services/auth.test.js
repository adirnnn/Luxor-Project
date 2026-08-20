import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret';
const { signToken, authenticate, authorizeSelfOrRoles, requireRoles } = await import('./auth.js');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('signToken + authenticate: token válido adjunta req.user', () => {
  const token = signToken({ id: 5, role: 'CLIENTE' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockRes();
  let nextCalled = false;
  authenticate(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { id: 5, role: 'CLIENTE' });
});

test('authenticate: sin header rechaza con 401', () => {
  const req = { headers: {} };
  const res = mockRes();
  let nextCalled = false;
  authenticate(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('authenticate: token inválido rechaza con 401', () => {
  const req = { headers: { authorization: 'Bearer not-a-real-token' } };
  const res = mockRes();
  let nextCalled = false;
  authenticate(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('authorizeSelfOrRoles: permite acceso propio (IDOR bloqueado para terceros)', () => {
  const mw = authorizeSelfOrRoles('userId', 'ADMIN');
  const resOwn = mockRes();
  let nextCalled = false;
  mw({ user: { id: 7, role: 'CLIENTE' }, params: { userId: '7' } }, resOwn, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  const resOther = mockRes();
  nextCalled = false;
  mw({ user: { id: 7, role: 'CLIENTE' }, params: { userId: '8' } }, resOther, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(resOther.statusCode, 403);

  const resAdmin = mockRes();
  nextCalled = false;
  mw({ user: { id: 1, role: 'ADMIN' }, params: { userId: '8' } }, resAdmin, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('requireRoles: rechaza rol no permitido', () => {
  const mw = requireRoles('ADMIN');
  const res = mockRes();
  let nextCalled = false;
  mw({ user: { id: 1, role: 'CLIENTE' } }, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});
