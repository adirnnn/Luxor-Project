// Integración SFTWRKEY-446: webhook de Recurrente contra PostgreSQL real. Recurrente se simula en
// helpers.js y los avisos se firman con el secreto de pruebas, igual que los manda Svix.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, stopServer, api, apiUrl, registerClient, insertProduct, productStock, cleanup, pool,
  fakeGateway, sendWebhook,
} from './helpers.js';

const created = { users: [], products: [] };
let client;

before(async () => {
  await startServer();
  client = await registerClient(created.users);
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

// el cliente abre el pago y se va a Recurrente
async function abrirPago(stock = 5, quantity = 2) {
  const perfume = await insertProduct(created.products, { price: 150, stock });
  await api('POST', `/cart/${client.id}`, { token: client.token, body: [{ product_id: perfume.id, quantity }] });
  const res = await api('POST', `/checkout/${client.id}`, { token: client.token, body: {} });
  assert.equal(res.status, 201);
  return { perfume, reference: res.body.reference, checkoutId: await fakeGateway.checkoutId(res.body.reference) };
}

const avisoPagado = (checkoutId) => ({
  event_type: 'intent.succeeded',
  id: `in_${checkoutId}`,
  status: 'succeeded',
  amount_in_cents: 30000,
  currency: 'GTQ',
  checkout: { id: checkoutId, status: 'paid' },
  payment: { id: `pa_${checkoutId}` },
  customer: { email: 'cliente@prueba.com', full_name: 'Cliente Prueba' },
});

const pedidosDeLaSesion = async (reference) =>
  (
    await pool.query(
      `SELECT o.id FROM orders o JOIN checkout_sessions s ON s.order_id = o.id WHERE s.id = $1`,
      [reference]
    )
  ).rows;
const pedidosDelCliente = async () =>
  (await pool.query('SELECT COUNT(*)::int AS n FROM orders WHERE user_id = $1', [client.id])).rows[0].n;
const eventos = async (checkoutId) =>
  (await pool.query('SELECT status, order_id, payload FROM payment_webhook_events WHERE checkout_id = $1 ORDER BY id', [checkoutId])).rows;

test('el cliente paga y cierra la página: el webhook deja el pedido pagado igual', async () => {
  const { perfume, reference, checkoutId } = await abrirPago();
  await fakeGateway.pay(reference);

  // nunca vuelve a /pago/resultado; solo llega el aviso de Recurrente
  const res = await sendWebhook(avisoPagado(checkoutId));

  assert.equal(res.status, 200);
  const pedidos = await pedidosDeLaSesion(reference);
  assert.equal(pedidos.length, 1);
  const orden = await pool.query('SELECT status FROM orders WHERE id = $1', [pedidos[0].id]);
  assert.equal(orden.rows[0].status, 'pagado');
  assert.equal(await productStock(perfume.id), 3);

  const [evento] = await eventos(checkoutId);
  assert.equal(evento.status, 'procesado');
  assert.equal(evento.order_id, pedidos[0].id);
  // el registro no guarda el nombre ni el correo del cliente
  assert.equal(evento.payload.customer, undefined);
});

test('un aviso repetido no crea otro pedido ni descuenta stock otra vez', async () => {
  const { perfume, reference, checkoutId } = await abrirPago();
  await fakeGateway.pay(reference);
  const antes = await pedidosDelCliente();

  // el mismo aviso (mismo svix-id) llega tres veces, y otro aviso distinto del mismo pago
  const primero = await sendWebhook(avisoPagado(checkoutId), { id: `msg_rep_${checkoutId}` });
  const repetido = await sendWebhook(avisoPagado(checkoutId), { id: `msg_rep_${checkoutId}` });
  await sendWebhook(avisoPagado(checkoutId), { id: `msg_rep_${checkoutId}` });
  const otroAviso = await sendWebhook({ ...avisoPagado(checkoutId), event_type: 'payment_intent.succeeded' });

  assert.equal(primero.status, 200);
  assert.equal(repetido.status, 200);
  assert.equal(repetido.body.duplicate, true);
  assert.equal(otroAviso.status, 200);
  assert.equal(await pedidosDelCliente(), antes + 1, 'un solo pedido');
  assert.equal(await productStock(perfume.id), 3, 'el stock se descontó una sola vez');
  const pagos = await pool.query(
    `SELECT COUNT(*)::int AS n FROM payments WHERE status = 'aprobado' AND gateway_reference = $1`,
    [`pa_${checkoutId}`]
  );
  assert.equal(pagos.rows[0].n, 1, 'un solo pago aprobado');
});

test('el aviso y la vuelta del cliente al mismo tiempo crean un solo pedido', async () => {
  const { reference, checkoutId } = await abrirPago();
  await fakeGateway.pay(reference);

  await Promise.all([
    sendWebhook(avisoPagado(checkoutId)),
    api('POST', '/checkout/confirm', { body: { reference } }),
    sendWebhook(avisoPagado(checkoutId)),
  ]);

  assert.equal((await pedidosDeLaSesion(reference)).length, 1);
});

test('un aviso con firma inválida responde 401 y no cambia nada', async () => {
  const { perfume, reference, checkoutId } = await abrirPago();
  await fakeGateway.pay(reference);
  const antes = await pedidosDelCliente();

  const otroSecreto = await sendWebhook(avisoPagado(checkoutId), {
    secret: `whsec_${Buffer.from('secreto-de-un-atacante').toString('base64')}`,
  });
  const viejo = await sendWebhook(avisoPagado(checkoutId), { timestamp: String(Math.floor(Date.now() / 1000) - 3600) });
  const sinFirma = await fetch(apiUrl('/webhooks/recurrente'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(avisoPagado(checkoutId)),
  });

  assert.equal(otroSecreto.status, 401);
  assert.equal(viejo.status, 401);
  assert.equal(sinFirma.status, 401);
  assert.equal(await pedidosDelCliente(), antes, 'no se crea el pedido');
  assert.equal(await productStock(perfume.id), 3, 'el stock sigue apartado, sin cambios');
  const sesion = await pool.query('SELECT status FROM checkout_sessions WHERE id = $1', [reference]);
  assert.equal(sesion.rows[0].status, 'pendiente');
  const invalidas = await pool.query(`SELECT COUNT(*)::int AS n FROM payment_webhook_events WHERE status = 'firma_invalida'`);
  assert.ok(invalidas.rows[0].n >= 2, 'los intentos quedan registrados');
});

test('un aviso firmado que dice "pagado" no basta: si Recurrente no lo confirma, no hay pedido', async () => {
  const { reference, checkoutId } = await abrirPago();
  // Recurrente todavía muestra el checkout sin pagar

  const res = await sendWebhook(avisoPagado(checkoutId));

  assert.equal(res.status, 500, 'Recurrente lo reintenta más tarde');
  assert.equal((await pedidosDeLaSesion(reference)).length, 0);
  const [evento] = await eventos(checkoutId);
  assert.equal(evento.status, 'error');

  // cuando Recurrente lo confirma, el reintento del mismo aviso sí crea el pedido
  await fakeGateway.pay(reference);
  const reintento = await sendWebhook(avisoPagado(checkoutId), { id: `msg_reintento_${checkoutId}` });
  assert.equal(reintento.status, 200);
  assert.equal((await pedidosDeLaSesion(reference)).length, 1);
});

test('un rechazo queda registrado y la sesión sigue abierta para intentar con otra tarjeta', async () => {
  const { perfume, reference, checkoutId } = await abrirPago();

  const res = await sendWebhook({
    event_type: 'intent.failed',
    status: 'failed',
    checkout: { id: checkoutId, status: 'unpaid' },
    details: { failure_reason: 'Fondos insuficientes' },
  });

  assert.equal(res.status, 200);
  const [evento] = await eventos(checkoutId);
  assert.equal(evento.status, 'rechazo');
  assert.equal(evento.payload.failure_reason, 'Fondos insuficientes');
  const sesion = await pool.query('SELECT status FROM checkout_sessions WHERE id = $1', [reference]);
  assert.equal(sesion.rows[0].status, 'pendiente');
  assert.equal(await productStock(perfume.id), 3);
});

test('un checkout que no es de la tienda se registra como ignorado', async () => {
  const res = await sendWebhook(avisoPagado('ch_de_otro_lado'));
  assert.equal(res.status, 200);
  const [evento] = await eventos('ch_de_otro_lado');
  assert.equal(evento.status, 'ignorado');
});

test('sin RECURRENTE_WEBHOOK_SECRET responde 503 para que Recurrente reintente', async () => {
  const secreto = process.env.RECURRENTE_WEBHOOK_SECRET;
  delete process.env.RECURRENTE_WEBHOOK_SECRET;
  try {
    const res = await sendWebhook(avisoPagado('ch_x'), { secret: secreto });
    assert.equal(res.status, 503);
  } finally {
    process.env.RECURRENTE_WEBHOOK_SECRET = secreto;
  }
});

test('la base rechaza registrar dos veces como aprobado el mismo pago de Recurrente', async () => {
  const { reference, checkoutId } = await abrirPago();
  await fakeGateway.pay(reference);
  await sendWebhook(avisoPagado(checkoutId));
  const { rows } = await pool.query(`SELECT order_id, amount FROM payments WHERE gateway_reference = $1`, [`pa_${checkoutId}`]);

  await assert.rejects(
    pool.query(
      `INSERT INTO payments (order_id, user_id, amount, status, gateway_reference) VALUES ($1, $2, $3, 'aprobado', $4)`,
      [rows[0].order_id, client.id, rows[0].amount, `pa_${checkoutId}`]
    ),
    (err) => err.code === '23505'
  );
});
