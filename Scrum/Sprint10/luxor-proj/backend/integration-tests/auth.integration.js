// Integración: rutas de autenticación (Express) + bcrypt + JWT + PostgreSQL (users, rol).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, api, login, cleanup, pool } from './helpers.js';

const created = { users: [] };
const email = `it-auth-${Date.now()}@prueba.com`;
const password = 'clave-segura-123';

before(startServer);
after(async () => {
  await cleanup(created);
  await stopServer();
});

test('POST /register guarda el usuario en PostgreSQL con contraseña hasheada y rol CLIENTE', async () => {
  const res = await api('POST', '/register', { body: { name: 'Ana Integración', email, password } });

  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, email);
  created.users.push(res.body.user.id);

  const { rows } = await pool.query(
    `SELECT u.password, r.nombre AS rol FROM users u JOIN rol r ON u.role = r.id_rol WHERE u.email = $1`,
    [email]
  );
  assert.equal(rows.length, 1, 'el usuario debe existir en la tabla users');
  assert.notEqual(rows[0].password, password, 'la contraseña no se guarda en texto plano');
  assert.match(rows[0].password, /^\$2[aby]\$12\$/, 'se guarda un hash bcrypt con 12 rondas');
  assert.equal(rows[0].rol, 'CLIENTE');
});

test('POST /login valida contra la base y el JWT emitido da acceso a GET /user/:id', async () => {
  const { token, user } = await login(email, password);

  assert.ok(token, 'el login devuelve un token');
  assert.equal(user.role, 'CLIENTE');

  const perfil = await api('GET', `/user/${user.id}`, { token });
  assert.equal(perfil.status, 200);
  assert.equal(perfil.body.user.email, email);
});

test('POST /login rechaza una contraseña incorrecta', async () => {
  const res = await api('POST', '/login', { body: { email, password: 'otra-clave' } });
  assert.equal(res.status, 401);
});

test('POST /register con un correo existente responde 409 (restricción UNIQUE de la base)', async () => {
  const res = await api('POST', '/register', { body: { name: 'Duplicado', email, password } });

  assert.equal(res.status, 409);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE email = $1', [email]);
  assert.equal(rows[0].n, 1, 'no se crea un segundo registro');
});
