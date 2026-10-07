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

// Pruebas de /login y /register 
import bcrypt from 'bcryptjs';
const { createLoginHandler, createRegisterHandler } = await import('./authHandlers.js');
const { default: jwt } = await import('jsonwebtoken');

const TEST_SALT_ROUNDS = 4; 

function mockPool({ rows = [], error = null } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (error) throw error;
      return { rows, rowCount: rows.length };
    },
  };
}

const loginRes = () => mockRes();

// /login

test('POST /login: credenciales correctas devuelven 200, token y usuario público', async () => {
  const passwordHash = await bcrypt.hash('Secreta123', TEST_SALT_ROUNDS);
  const pool = mockPool({
    rows: [{ id: 42, name: 'Ana Cliente', email: 'ana@luxor.com', password_hash: passwordHash, role: 'CLIENTE' }],
  });
  const handler = createLoginHandler({ pool, bcrypt, signToken });
  const req = { body: { email: 'ana@luxor.com', password: 'Secreta123' } };
  const res = loginRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token, 'debe devolver un token');
  assert.deepEqual(res.body.user, { id: 42, name: 'Ana Cliente', role: 'CLIENTE' });
  // El token es válido y no filtra el hash ni el correo.
  const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
  assert.equal(payload.id, 42);
  assert.equal(payload.role, 'CLIENTE');
  assert.equal(payload.password_hash, undefined);
  // La consulta se hizo parametrizada (sin concatenar el email en el SQL).
  assert.deepEqual(pool.calls[0].params, ['ana@luxor.com']);
});

test('POST /login: contraseña incorrecta rechaza con 401 y no emite token', async () => {
  const passwordHash = await bcrypt.hash('Secreta123', TEST_SALT_ROUNDS);
  const pool = mockPool({
    rows: [{ id: 42, name: 'Ana Cliente', email: 'ana@luxor.com', password_hash: passwordHash, role: 'CLIENTE' }],
  });
  const handler = createLoginHandler({ pool, bcrypt, signToken });
  const res = loginRes();

  await handler({ body: { email: 'ana@luxor.com', password: 'contraseña-erronea' } }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.token, undefined);
});

test('POST /login: usuario inexistente rechaza con 401 con el mismo mensaje genérico', async () => {
  const pool = mockPool({ rows: [] }); // el correo no está en la base
  const handler = createLoginHandler({ pool, bcrypt, signToken });
  const res = loginRes();

  await handler({ body: { email: 'nadie@luxor.com', password: 'Secreta123' } }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.token, undefined);
  // Mensaje idéntico al de contraseña incorrecta: no se revela si la cuenta existe.
  assert.equal(res.body.message, 'Error');
});

// /register

test('POST /register: correo con formato inválido rechaza con 400 y no toca la base', async () => {
  const pool = mockPool({ rows: [{ id: 1, name: 'Bruno', email: 'bruno' }] });
  const handler = createRegisterHandler({ pool, bcrypt, saltRounds: TEST_SALT_ROUNDS });
  const res = mockRes();

  await handler({ body: { name: 'Bruno', email: 'bruno-arroba-luxor.com', password: 'Secreta123' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /correo/i);
  assert.equal(pool.calls.length, 0, 'no debe ejecutarse ningún INSERT');
});

test('POST /register: contraseña menor al mínimo rechaza con 400 y no toca la base', async () => {
  const pool = mockPool({ rows: [{ id: 1, name: 'Bruno', email: 'bruno@luxor.com' }] });
  const handler = createRegisterHandler({ pool, bcrypt, saltRounds: TEST_SALT_ROUNDS });
  const res = mockRes();

  await handler({ body: { name: 'Bruno', email: 'bruno@luxor.com', password: '12345' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /6 caracteres/);
  assert.equal(pool.calls.length, 0, 'no debe ejecutarse ningún INSERT');
});

test('POST /register: correo duplicado responde 409 (unique_violation 23505)', async () => {
  const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
  const pool = mockPool({ error: duplicate });
  const handler = createRegisterHandler({ pool, bcrypt, saltRounds: TEST_SALT_ROUNDS });
  const res = mockRes();

  await handler({ body: { name: 'Bruno', email: 'ana@luxor.com', password: 'Secreta123' } }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /ya está registrado/);
});

test('POST /register: registro exitoso devuelve 201 y guarda la contraseña hasheada', async () => {
  const pool = mockPool({ rows: [{ id: 77, name: 'Bruno', email: 'bruno@luxor.com' }] });
  const handler = createRegisterHandler({ pool, bcrypt, saltRounds: TEST_SALT_ROUNDS });
  const res = mockRes();

  await handler({ body: { name: 'Bruno', email: 'bruno@luxor.com', password: 'Secreta123' } }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.user, { id: 77, name: 'Bruno', email: 'bruno@luxor.com', role: 'CLIENTE' });
  assert.equal(res.body.user.password, undefined, 'la respuesta no debe incluir la contraseña');

  // La contraseña que llega a la base es un hash bcrypt verificable, nunca texto plano.
  const [, , storedPassword] = pool.calls[0].params;
  assert.notEqual(storedPassword, 'Secreta123');
  assert.match(storedPassword, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare('Secreta123', storedPassword), true);
});
