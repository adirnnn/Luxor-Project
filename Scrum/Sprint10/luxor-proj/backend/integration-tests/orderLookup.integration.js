// Integración: SFTWRKEY-458, el chatbot consulta el estado de un pedido con el número y el correo,
// con la API real y PostgreSQL real (pedido de un cliente con cuenta y pedido de un invitado).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, api, apiUrl, registerClient, insertProduct, cleanup, pool, buyWithAccount, loginAdmin,
} from './helpers.js';

const created = { users: [], products: [] };
const pedidosInvitado = [];
let cliente;
let pedidoCliente;
let pedidoInvitado;

const consultar = (order_id, email, ip = '198.51.100.20') =>
  fetch(apiUrl('/internal/orders/lookup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Key': process.env.CHATBOT_INTERNAL_KEY, 'X-Client-IP': ip },
    body: JSON.stringify({ order_id, email }),
  });

before(async () => {
  await startServer();
  cliente = await registerClient(created.users);
  const perfume = await insertProduct(created.products, { price: 300, stock: 5 });

  // compra real del cliente por la API
  const compra = await buyWithAccount(cliente, [{ product_id: perfume.id, quantity: 1 }]);
  assert.equal(compra.body.status, 'pagado');
  pedidoCliente = compra.body.order.id;

  // el admin lo pasa a "en preparación" (queda en el historial)
  const admin = await loginAdmin();
  const cambio = await api('PATCH', `/admin/orders/${pedidoCliente}/status`, { token: admin, body: { status: 'en_preparacion' } });
  assert.equal(cambio.status, 200);

  // pedido de invitado: el correo vive en guest_receipts
  const { rows } = await pool.query(`INSERT INTO orders (user_id, total, status) VALUES (NULL, 300, 'pagado') RETURNING id`);
  pedidoInvitado = rows[0].id;
  pedidosInvitado.push(pedidoInvitado);
  await pool.query(
    `INSERT INTO guest_receipts (key_hash, request_hash, order_id, guest_name, guest_email, address, response)
     VALUES ($1, 'x', $2, 'Invitado Prueba', 'Invitado.Prueba@Correo.com', '{}', '{}')`,
    [`it-458-${Date.now()}`, pedidoInvitado]
  );
});

after(async () => {
  await pool.query('DELETE FROM guest_receipts WHERE order_id = ANY($1::int[])', [pedidosInvitado]);
  await pool.query('DELETE FROM order_status_history WHERE order_id = ANY($1::int[])', [pedidosInvitado]).catch(() => {});
  await pool.query('DELETE FROM orders WHERE id = ANY($1::int[])', [pedidosInvitado]);
  await cleanup(created);
  await stopServer();
});

test('cliente con cuenta: número y correo correctos devuelven el estado actual', async () => {
  const res = await consultar(pedidoCliente, cliente.email.toUpperCase());
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.order.id, pedidoCliente);
  assert.equal(body.order.status, 'en_preparacion');
  assert.deepEqual(Object.keys(body.order).sort(), ['created_at', 'id', 'status', 'updated_at']);
});

test('invitado: se busca con el correo que dejó al comprar', async () => {
  const res = await consultar(pedidoInvitado, 'invitado.prueba@correo.com', '198.51.100.21');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).order.status, 'pagado');
});

test('el correo de un pedido no sirve para ver el de otra persona', async () => {
  const cruzado = await consultar(pedidoInvitado, cliente.email, '198.51.100.22');
  const otro = await consultar(pedidoCliente, 'invitado.prueba@correo.com', '198.51.100.22');

  assert.equal(cruzado.status, 404);
  assert.equal(otro.status, 404);
  assert.deepEqual(await cruzado.json(), { found: false, message: 'No encontramos ese pedido.' });
});

test('sin la clave interna no responde nada', async () => {
  const res = await fetch(apiUrl('/internal/orders/lookup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: pedidoCliente, email: cliente.email }),
  });
  assert.equal(res.status, 401);
});
