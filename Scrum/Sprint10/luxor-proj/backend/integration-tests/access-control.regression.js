// Regresión R3 — Control de acceso (SFTWRKEY-378/379).
// Comportamiento validado que se protege: un cliente solo accede a sus propios datos,
// no puede usar rutas de administrador y sin token no se accede a rutas privadas.
// Cambio que lo rompería: refactorizar authorizeSelfOrRoles/requireRoles o registrar
// una ruta nueva olvidando el middleware de autenticación.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, api, registerClient, insertProduct, cleanup, pool } from './helpers.js';

const created = { users: [], products: [] };
let ana;
let beto;
let perfume;

before(async () => {
  await startServer();
  ana = await registerClient(created.users);
  beto = await registerClient(created.users);
  perfume = await insertProduct(created.products);
  await api('POST', `/cart/${beto.id}`, { token: beto.token, body: [{ product_id: perfume.id, quantity: 1 }] });
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

test('un cliente no puede leer el carrito, el perfil ni los pedidos de otro cliente (403)', async () => {
  for (const ruta of [`/cart/${beto.id}`, `/user/${beto.id}`, `/user/${beto.id}/orders`]) {
    const res = await api('GET', ruta, { token: ana.token });
    assert.equal(res.status, 403, `GET ${ruta} con el token de otro cliente`);
  }
});

test('un cliente no puede reemplazar el carrito de otro cliente', async () => {
  const res = await api('POST', `/cart/${beto.id}`, { token: ana.token, body: [] });

  assert.equal(res.status, 403);
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE c.user_id = $1',
    [beto.id]
  );
  assert.equal(rows[0].n, 1, 'el carrito de la víctima sigue intacto');
});

test('un cliente no puede crear ni borrar productos (rutas solo para ADMIN)', async () => {
  const crear = await api('POST', '/products', {
    token: ana.token,
    body: { id: `it-intruso-${Date.now()}`, name: 'Intruso', price: '1.00', stock: 1 },
  });
  assert.equal(crear.status, 403);

  const borrar = await api('DELETE', `/products/${perfume.id}`, { token: ana.token });
  assert.equal(borrar.status, 403);
  assert.equal((await pool.query('SELECT 1 FROM products WHERE id = $1', [perfume.id])).rows.length, 1);
});

test('sin token o con un token inválido las rutas privadas responden 401', async () => {
  assert.equal((await api('GET', `/cart/${ana.id}`)).status, 401);
  assert.equal((await api('GET', '/report', { token: 'token.invalido.123' })).status, 401);
});
