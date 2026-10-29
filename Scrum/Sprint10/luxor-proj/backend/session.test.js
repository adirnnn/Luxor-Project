// SFTWRKEY-451: sesión en una cookie httpOnly, cierre de sesión y protección contra CSRF.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';
process.env.GOOGLE_CLIENT_ID = 'cliente-de-prueba.apps.googleusercontent.com';

const { OAuth2Client } = await import('google-auth-library');
const { default: bcrypt } = await import('bcryptjs');
const { default: pool } = await import('./db.js');
const { signToken, SESSION_COOKIE } = await import('./services/auth.js');
const { default: app } = await import('./server.js');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
let server;
let baseUrl;
let ip = 10;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Doble del pool de PostgreSQL (mismo patrón que carChekout.test.js)
function fakeDb(routes = []) {
  const log = [];
  const original = { query: pool.query, connect: pool.connect };
  const run = async (sql, params) => {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    log.push({ sql: text, params });
    for (const [pattern, respond] of routes) {
      if (pattern.test(text)) {
        const result = typeof respond === 'function' ? await respond(params, log) : respond;
        return result ?? { rows: [], rowCount: 0 };
      }
    }
    return { rows: [], rowCount: 0 };
  };
  pool.query = run;
  pool.connect = async () => ({ query: run, release() {} });
  return { log, restore: () => { pool.query = original.query; pool.connect = original.connect; } };
}

const HASH = await bcrypt.hash('clave-segura-123', 4);
const usuarioEnBase = [/FROM users u JOIN rol r ON u.role = r.id_rol WHERE LOWER\(u.email\)/i,
  { rows: [{ id: 7, name: 'Ana', email: 'ana@luxor.com', password_hash: HASH, role: 'CLIENTE' }] }];
const perfilEnBase = [/FROM users u JOIN rol r ON u.role = r.id_rol (LEFT JOIN user_avatars a ON a.user_id = u.id )?WHERE u.id = \$1/i,
  (params) => ({ rows: params[0] === 7 ? [{ id: 7, name: 'Ana', email: 'ana@luxor.com', role: 'CLIENTE' }] : [] })];

const pedir = (method, ruta, { cookie, token, origin, body } = {}) =>
  fetch(`${baseUrl}${ruta}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `198.51.100.${ip++}`,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const login = (password = 'clave-segura-123', origin = FRONTEND) =>
  pedir('POST', '/login', { origin, body: { email: 'ana@luxor.com', password } });

// "luxor_sesion=<jwt>" tal como lo devolvería el navegador
const cookieDe = (res) => res.headers.get('set-cookie').split(';')[0];

test('el login guarda la sesión en una cookie httpOnly, SameSite=Lax, de 8 horas', async (t) => {
  const { restore } = fakeDb([usuarioEnBase]);
  t.after(restore);

  const res = await login();
  assert.equal(res.status, 200);
  // el token solo va en la cookie: la respuesta (que sí puede leer JavaScript) no lo trae
  const body = await res.json();
  assert.equal(body.token, undefined);
  assert.deepEqual(body.user, { id: 7, name: 'Ana', role: 'CLIENTE' });

  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=28800/);
  // en local (http) no es Secure, si no Safari no la guardaría
  assert.doesNotMatch(cookie, /Secure/);

  // la cookie es un JWT válido de ese usuario
  const valor = decodeURIComponent(cookieDe(res).split('=')[1]);
  assert.equal(jwt.verify(valor, 'test-secret').id, 7);
});

test('en producción la cookie además es Secure (solo viaja por https)', async (t) => {
  const { restore } = fakeDb([usuarioEnBase]);
  const antes = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => { restore(); process.env.NODE_ENV = antes; });

  const res = await login();
  assert.match(res.headers.get('set-cookie'), /Secure/);
});

test('un login fallido no crea cookie', async (t) => {
  const { restore } = fakeDb([usuarioEnBase]);
  t.after(restore);

  const res = await login('otra-clave-cualquiera');
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('con la cookie se entra a las rutas protegidas y /me responde quién es', async (t) => {
  const { restore } = fakeDb([usuarioEnBase, perfilEnBase]);
  t.after(restore);
  const cookie = cookieDe(await login());

  const yo = await pedir('GET', '/me', { cookie });
  assert.equal(yo.status, 200);
  assert.deepEqual((await yo.json()).user, { id: 7, name: 'Ana', email: 'ana@luxor.com', role: 'CLIENTE', avatarVersion: null });
  assert.equal(yo.headers.get('cache-control'), 'no-store');

  assert.equal((await pedir('GET', '/user/7/orders', { cookie })).status, 200);
  // la cookie de un CLIENTE no abre rutas de admin
  assert.equal((await pedir('GET', '/admin/orders', { cookie })).status, 403);
});

test('sin cookie, con una cookie inventada o firmada con otra clave, responde 401', async (t) => {
  const { restore } = fakeDb([perfilEnBase]);
  t.after(restore);
  const falsa = jwt.sign({ id: 7, role: 'ADMIN' }, 'otra-clave');

  for (const cookie of [undefined, `${SESSION_COOKIE}=abc`, `${SESSION_COOKIE}=${falsa}`, `${SESSION_COOKIE}=%E0%A4%A`, 'otra_cookie=1']) {
    assert.equal((await pedir('GET', '/me', { cookie })).status, 401, String(cookie));
  }
});

test('/me de un usuario que ya no existe responde 401 y borra la cookie', async (t) => {
  const { restore } = fakeDb([perfilEnBase]);
  t.after(restore);

  const res = await pedir('GET', '/me', { cookie: `${SESSION_COOKIE}=${signToken({ id: 99, role: 'CLIENTE' })}` });
  assert.equal(res.status, 401);
  assert.match(res.headers.get('set-cookie'), new RegExp(`${SESSION_COOKIE}=;.*Expires=Thu, 01 Jan 1970`));
});

test('cerrar sesión borra la cookie', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await pedir('POST', '/logout', { origin: FRONTEND });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=;`));
  assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
  assert.match(cookie, /HttpOnly/);
});

test('CSRF: otro sitio no puede cambiar datos con la cookie del cliente', async (t) => {
  const { log, restore } = fakeDb([[/FROM carts|INSERT INTO carts/i, { rows: [{ id: 1 }] }]]);
  t.after(restore);
  const cookie = `${SESSION_COOKIE}=${signToken({ id: 7, role: 'CLIENTE' })}`;
  const body = [{ product_id: 'khamrah', quantity: 1 }];

  for (const origin of ['https://sitio-malicioso.com', 'null', `${FRONTEND}.evil.com`]) {
    const res = await pedir('POST', '/cart/7', { cookie, origin, body });
    assert.equal(res.status, 403, origin);
  }
  assert.equal(log.some((e) => /cart_items/i.test(e.sql)), false, 'no tocó el carrito');

  // desde nuestro frontend sí
  assert.equal((await pedir('POST', '/cart/7', { cookie, origin: FRONTEND, body })).status, 200);
});

test('CSRF: otro sitio tampoco puede iniciar sesión ni cerrarla por el cliente', async (t) => {
  const { restore } = fakeDb([usuarioEnBase]);
  t.after(restore);

  const res = await login('clave-segura-123', 'https://sitio-malicioso.com');
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal((await pedir('POST', '/logout', { origin: 'https://sitio-malicioso.com' })).status, 403);
});

test('las lecturas (GET) y los clientes que no son navegador (sin Origin, con Bearer) siguen funcionando', async (t) => {
  const { restore } = fakeDb([perfilEnBase, [/FROM carts|INSERT INTO carts/i, { rows: [{ id: 1 }] }]]);
  t.after(restore);
  const token = signToken({ id: 7, role: 'CLIENTE' });

  assert.equal((await pedir('GET', '/products', { origin: 'https://otro-sitio.com' })).status, 200);
  assert.equal((await pedir('POST', '/cart/7', { token, body: [{ product_id: 'khamrah', quantity: 1 }] })).status, 200);
  assert.equal((await pedir('GET', '/me', { token })).status, 200);
});

test('el login con Google también deja la sesión solo en la cookie', async (t) => {
  const original = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => ({
    getPayload: () => ({ sub: 'google-7', email: 'ana@gmail.com', email_verified: true, nonce: 'n-1', name: 'Ana', exp: 9999999999 }),
  });
  const { restore } = fakeDb([
    [/INSERT INTO google_used_tokens/i, { rows: [{ token_hash: 'x' }] }],
    [/FROM google_accounts g/i, { rows: [{ id: 7, name: 'Ana', email: 'ana@gmail.com', role: 'CLIENTE' }] }],
  ]);
  t.after(() => { restore(); OAuth2Client.prototype.verifyIdToken = original; });

  const res = await pedir('POST', '/auth/google', { origin: FRONTEND, body: { credential: 'token-de-google', nonce: 'n-1' } });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.token, undefined);
  assert.equal(body.user.id, 7);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(cookie, /HttpOnly/);
  assert.equal(jwt.verify(decodeURIComponent(cookie.split(';')[0].split('=')[1]), 'test-secret').id, 7);
});

test('CSRF no aplica al webhook de Recurrente: lo valida su firma, no el origen', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);

  const res = await fetch(`${baseUrl}/webhooks/recurrente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.recurrente.com' },
    body: JSON.stringify({ event_type: 'intent.succeeded' }),
  });
  // lo atiende el webhook (que sin su clave o sin firma válida no procesa nada), no la protección CSRF
  assert.notEqual(res.status, 403);
  assert.notEqual((await res.json()).message, 'Origen no permitido.');
});
