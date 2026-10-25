// SFTWRKEY-447 / SFTWRKEY-448: correos de confirmación y de cambio de estado del pedido
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { buildOrderEmail, sendOrderEmail } = await import('./services/mailer.js');
const { notifyOrderStatus } = await import('./services/orderEmails.js');

const quietLogger = () => {
  const calls = { warn: [], error: [] };
  return { calls, warn: (...a) => calls.warn.push(a.join(' ')), error: (...a) => calls.error.push(a.join(' ')) };
};

const items = [{ name: 'Oud Royal', quantity: 2, unit_price: '390.00' }];
const baseOrder = { orderId: 12, customerName: 'María', items, total: 780, accountUrl: 'https://tienda.test/mi-cuenta' };

test('el correo trae número de pedido, productos, total y enlace a Mi cuenta', () => {
  const { subject, text, html } = buildOrderEmail({ status: 'pagado', ...baseOrder });
  assert.match(subject, /#12/);
  for (const body of [text, html]) {
    assert.match(body, /Oud Royal/);
    assert.match(body, /Q780\.00/);
    assert.match(body, /https:\/\/tienda\.test\/mi-cuenta/);
  }
  assert.match(html, /Perfumería Victoria/);
});

test('cada estado tiene su propio asunto', () => {
  const subjects = ['pagado', 'enviado', 'entregado', 'cancelado'].map(
    (status) => buildOrderEmail({ status, ...baseOrder }).subject
  );
  assert.equal(new Set(subjects).size, 4);
  assert.throws(() => buildOrderEmail({ status: 'en_preparacion', ...baseOrder }));
});

test('el HTML escapa nombres y productos', () => {
  const { html } = buildOrderEmail({
    status: 'pagado',
    ...baseOrder,
    customerName: '<script>x</script>',
    items: [{ name: '<img src=x onerror=1>', quantity: 1, unit_price: 10 }],
  });
  assert.doesNotMatch(html, /<script>|<img/);
});

test('sendOrderEmail sin RESEND_API_KEY no envía nada', async () => {
  let called = false;
  const result = await sendOrderEmail({ to: 'a@b.com', env: {}, fetchImpl: async () => { called = true; }, status: 'pagado', ...baseOrder });
  assert.deepEqual(result, { sent: false });
  assert.equal(called, false);
});

test('sendOrderEmail manda a Resend con el destinatario correcto', async () => {
  let request;
  const fetchImpl = async (url, init) => { request = { url, init }; return { ok: true }; };
  const result = await sendOrderEmail({ to: 'maria@test.com', env: { RESEND_API_KEY: 're_test' }, fetchImpl, status: 'enviado', ...baseOrder });
  assert.deepEqual(result, { sent: true });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.init.headers.Authorization, 'Bearer re_test');
  assert.deepEqual(JSON.parse(request.init.body).to, ['maria@test.com']);
});

const fakePool = ({ order, rows = items } = {}) => ({
  log: [],
  async query(sql, params) {
    this.log.push({ sql, params });
    if (/FROM orders o/.test(sql)) return { rows: order ? [order] : [] };
    return { rows };
  },
});

const env = { RESEND_API_KEY: 're_test', FRONTEND_URL: 'https://tienda.test/' };

test('notifyOrderStatus manda un solo correo al cliente del pedido', async () => {
  const db = fakePool({ order: { id: 5, total: '780.00', email: 'maria@test.com', name: 'María' } });
  const sent = [];
  const result = await notifyOrderStatus(db, 5, 'enviado', { env, logger: quietLogger(), send: async (m) => { sent.push(m); return { sent: true }; } });
  assert.deepEqual(result, { sent: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'maria@test.com');
  assert.equal(sent[0].status, 'enviado');
  assert.equal(sent[0].accountUrl, 'https://tienda.test/mi-cuenta');
  assert.equal(sent[0].total, 780);
});

test('notifyOrderStatus funciona con compras de invitado (correo del checkout)', async () => {
  const db = fakePool({ order: { id: 6, total: '100', email: 'invitado@test.com', name: 'Pedro' } });
  const sent = [];
  await notifyOrderStatus(db, 6, 'pagado', { env, logger: quietLogger(), send: async (m) => { sent.push(m); return { sent: true }; } });
  assert.equal(sent[0].to, 'invitado@test.com');
});

test('si el correo falla, no lanza error y se registra', async () => {
  const db = fakePool({ order: { id: 5, total: '10', email: 'a@b.com', name: 'A' } });
  const logger = quietLogger();
  const result = await notifyOrderStatus(db, 5, 'pagado', { env, logger, send: async () => { throw new Error('boom'); } });
  assert.deepEqual(result, { sent: false });
  assert.match(logger.calls.error[0], /boom/);
});

test('sin RESEND_API_KEY solo avisa en el log y no toca la base', async () => {
  const db = fakePool();
  const logger = quietLogger();
  const result = await notifyOrderStatus(db, 5, 'pagado', { env: {}, logger });
  assert.deepEqual(result, { sent: false });
  assert.equal(db.log.length, 0);
  assert.match(logger.calls.warn[0], /RESEND_API_KEY/);
});

test('estados sin correo (en_preparacion) no envían nada', async () => {
  const db = fakePool();
  const result = await notifyOrderStatus(db, 5, 'en_preparacion', { env, logger: quietLogger() });
  assert.deepEqual(result, { sent: false });
  assert.equal(db.log.length, 0);
});

test('pedido sin correo no envía y avisa', async () => {
  const db = fakePool({ order: { id: 5, total: '10', email: null, name: null } });
  const logger = quietLogger();
  const result = await notifyOrderStatus(db, 5, 'pagado', { env, logger, send: async () => assert.fail('no debía enviar') });
  assert.deepEqual(result, { sent: false });
  assert.equal(logger.calls.warn.length, 1);
});
