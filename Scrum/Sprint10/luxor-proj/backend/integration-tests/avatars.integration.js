// Integración (feedback del cliente): foto de perfil privada, solo para su dueño o un admin.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { startServer, stopServer, api, apiUrl, registerClient, cleanup, loginAdmin } from './helpers.js';

const created = { users: [], products: [] };
let ana;
let beto;

before(async () => {
  await startServer();
  ana = await registerClient(created.users);
  beto = await registerClient(created.users);
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

const subir = (usuario, data, type = 'image/png') =>
  fetch(apiUrl(`/user/${usuario.id}/avatar`), {
    method: 'POST',
    headers: { 'Content-Type': type, Authorization: `Bearer ${usuario.token}` },
    body: data,
  });
const ver = (usuario, token) =>
  fetch(apiUrl(`/user/${usuario.id}/avatar`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('el cliente sube su foto, se guarda como WebP cuadrado de 256 px y /me trae la versión', async () => {
  const png = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#d4af37' } }).png().toBuffer();

  const res = await subir(ana, png);
  assert.equal(res.status, 201);

  const foto = await ver(ana, ana.token);
  assert.equal(foto.status, 200);
  assert.equal(foto.headers.get('content-type'), 'image/webp');
  assert.match(foto.headers.get('cache-control'), /private/);
  const meta = await sharp(Buffer.from(await foto.arrayBuffer())).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 256, 256]);

  const yo = await api('GET', '/me', { token: ana.token });
  assert.ok(yo.body.user.avatarVersion > 0);
});

test('la foto es privada: otro cliente recibe 403 y sin sesión 401; el admin sí la ve', async () => {
  assert.equal((await ver(ana, beto.token)).status, 403);
  assert.equal((await ver(ana)).status, 401);
  assert.equal((await ver(ana, await loginAdmin())).status, 200);
  // tampoco puede cambiar la foto de otro
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png().toBuffer();
  assert.equal((await subir(ana, png).then(() => fetch(apiUrl(`/user/${ana.id}/avatar`), {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${beto.token}` },
    body: png,
  }))).status, 403);
});

test('un archivo que no es imagen se rechaza aunque diga image/png', async () => {
  const res = await subir(beto, Buffer.from('<script>alert(1)</script>'));
  assert.equal(res.status, 400);
});

test('quitar la foto la borra', async () => {
  const res = await api('DELETE', `/user/${ana.id}/avatar`, { token: ana.token });
  assert.equal(res.status, 200);
  assert.equal((await ver(ana, ana.token)).status, 404);
  const yo = await api('GET', '/me', { token: ana.token });
  assert.equal(yo.body.user.avatarVersion, null);
});
