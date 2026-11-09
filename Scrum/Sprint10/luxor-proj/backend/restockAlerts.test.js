// SFTWRKEY-450: "Avísame cuando vuelva" para perfumes agotados
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { default: app } = await import('./server.js');
const { notifyRestock, hashToken } = await import('./services/restockAlerts.js');
const { buildRestockEmail } = await import('./services/mailer.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Doble de las consultas: responde según el patrón y anota cada consulta
function fakeQuery(routes = []) {
  const log = [];
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
  return { log, run };
}

// Doble del pool de PostgreSQL
function fakeDb(routes = []) {
  const { log, run } = fakeQuery(routes);
  const original = { query: pool.query, connect: pool.connect };

  pool.query = run;
  pool.connect = async () => ({ query: run, release() {} });

  return { log, restore: () => { pool.query = original.query; pool.connect = original.connect; } };
}

const Q = {
  producto: /^SELECT id, stock FROM products WHERE id = \$1$/i,
  guardar: /^INSERT INTO restock_alerts/i,
  cancelar: /^DELETE FROM restock_alerts/i,
  reclamar: /^UPDATE restock_alerts a SET notified_at = NOW\(\)/i,
  token: /^UPDATE restock_alerts SET token_hash/i,
  devolver: /^UPDATE restock_alerts SET notified_at = NULL/i,
  actualizarProducto: /^UPDATE products SET/i,
};

const post = (ruta, body, headers = {}) =>
  fetch(`${baseUrl}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const agotado = { rows: [{ id: 'khamrah', stock: 0 }] };
const valido = { productId: 'khamrah', email: '  Ana@Correo.com ', consent: true };
const silencioso = { warn() {}, error() {} };

// ── POST /restock-alerts ────────────────────────────────────────────────────

test('guarda el aviso de un perfume agotado con el correo en minúsculas', async (t) => {
  const { log, restore } = fakeDb([[Q.producto, agotado]]);
  t.after(restore);

  const res = await post('/restock-alerts', valido);
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.match(body.message, /una sola vez/);
  const insert = log.find((q) => Q.guardar.test(q.sql));
  assert.ok(insert, 'debe guardar el aviso');
  assert.deepEqual(insert.params, ['khamrah', 'ana@correo.com']);
  // si ya estaba anotado no se duplica (y la respuesta es la misma)
  assert.match(insert.sql, /ON CONFLICT \(product_id, email\) WHERE notified_at IS NULL DO NOTHING/);
});

test('sin consentimiento no se guarda el correo', async (t) => {
  const { log, restore } = fakeDb([[Q.producto, agotado]]);
  t.after(restore);

  const res = await post('/restock-alerts', { ...valido, consent: false });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /aceptar/);
  assert.equal(log.some((q) => Q.guardar.test(q.sql)), false);
});

test('un correo inválido responde 400', async (t) => {
  const { log, restore } = fakeDb([[Q.producto, agotado]]);
  t.after(restore);

  const res = await post('/restock-alerts', { ...valido, email: 'no-es-correo' });
  assert.equal(res.status, 400);
  assert.equal(log.some((q) => Q.guardar.test(q.sql)), false);
});

test('un perfume con stock no acepta avisos (409)', async (t) => {
  const { log, restore } = fakeDb([[Q.producto, { rows: [{ id: 'khamrah', stock: 4 }] }]]);
  t.after(restore);

  const res = await post('/restock-alerts', valido);
  assert.equal(res.status, 409);
  assert.equal(log.some((q) => Q.guardar.test(q.sql)), false);
});

test('un perfume que no existe responde 404', async (t) => {
  const { restore } = fakeDb([[Q.producto, { rows: [] }]]);
  t.after(restore);

  const res = await post('/restock-alerts', { ...valido, productId: 'no-existe' });
  assert.equal(res.status, 404);
});

// ── POST /restock-alerts/unsubscribe ────────────────────────────────────────

test('no recibir más avisos: borra los avisos pendientes del correo del enlace', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const token = 'a'.repeat(64);
  const res = await post('/restock-alerts/unsubscribe', { token });
  assert.equal(res.status, 200);
  const borrar = log.find((q) => Q.cancelar.test(q.sql));
  assert.ok(borrar, 'debe borrar los avisos pendientes');
  assert.match(borrar.sql, /notified_at IS NULL/);
  // en la base solo está el hash del token
  assert.deepEqual(borrar.params, [hashToken(token)]);
});

test('un enlace inválido para cancelar responde 400', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const res = await post('/restock-alerts/unsubscribe', { token: 'cualquier-cosa' });
  assert.equal(res.status, 400);
  assert.equal(log.some((q) => Q.cancelar.test(q.sql)), false);
});

// ── notifyRestock ───────────────────────────────────────────────────────────

const env = { RESEND_API_KEY: 'test', FRONTEND_URL: 'https://tienda.example/' };

test('al reponer el stock manda un correo por persona y guarda solo el hash del enlace', async () => {
  const { run, log } = fakeQuery([
    [Q.reclamar, { rows: [
      { id: 1, email: 'ana@correo.com', product_id: 'khamrah', name: 'Khamrah', price: '390.00' },
      { id: 2, email: 'luis@correo.com', product_id: 'khamrah', name: 'Khamrah', price: '390.00' },
    ] }],
  ]);
  const enviados = [];
  const result = await notifyRestock(['khamrah', 'khamrah'], {
    db: { query: run },
    env,
    logger: silencioso,
    send: async (mail) => { enviados.push(mail); return { sent: true }; },
  });

  assert.equal(result.sent, 2);
  assert.deepEqual(enviados.map((m) => m.to), ['ana@correo.com', 'luis@correo.com']);
  assert.equal(enviados[0].productUrl, 'https://tienda.example/producto/khamrah');
  assert.equal(enviados[0].price, 390);

  // el mismo UPDATE que busca los avisos los marca como enviados: cada persona recibe uno solo
  const reclamo = log.find((q) => Q.reclamar.test(q.sql));
  assert.match(reclamo.sql, /a\.notified_at IS NULL AND p\.stock > 0/);
  assert.deepEqual(reclamo.params, [['khamrah']]);

  const token = enviados[0].unsubscribeUrl.match(/token=([a-f0-9]{64})$/)[1];
  const guardado = log.find((q) => Q.token.test(q.sql) && q.params[0] === 1);
  assert.equal(guardado.params[1], hashToken(token));
});

test('si el correo falla, el aviso vuelve a quedar pendiente', async () => {
  const { run, log } = fakeQuery([
    [Q.reclamar, { rows: [{ id: 7, email: 'ana@correo.com', product_id: 'khamrah', name: 'Khamrah', price: 390 }] }],
  ]);
  const result = await notifyRestock(['khamrah'], {
    db: { query: run },
    env,
    logger: silencioso,
    send: async () => { throw new Error('proveedor caído'); },
  });

  assert.equal(result.sent, 0);
  const devuelto = log.find((q) => Q.devolver.test(q.sql));
  assert.ok(devuelto, 'debe desmarcar el aviso');
  assert.deepEqual(devuelto.params, [7]);
});

test('sin proveedor de correo no toca los avisos', async () => {
  const log = [];
  const result = await notifyRestock(['khamrah'], {
    db: { query: async (sql) => { log.push(sql); return { rows: [] }; } },
    env: {},
    logger: silencioso,
  });
  assert.equal(result.sent, 0);
  assert.equal(log.length, 0);
});

test('el correo escapa el nombre del perfume y trae el enlace para no recibir más avisos', () => {
  const mail = buildRestockEmail({
    productName: '<b>Khamrah</b>',
    price: 390,
    productUrl: 'https://tienda.example/producto/khamrah',
    unsubscribeUrl: 'https://tienda.example/avisos/cancelar?token=abc',
  });
  assert.match(mail.subject, /Volvió/);
  assert.match(mail.html, /&lt;b&gt;Khamrah&lt;\/b&gt;/);
  assert.match(mail.html, /avisos\/cancelar\?token=abc/);
  assert.match(mail.text, /Q390\.00/);
});

// ── el panel repone el stock ────────────────────────────────────────────────

test('editar un perfume con stock revisa los avisos pendientes', async (t) => {
  const { log, restore } = fakeDb([[Q.actualizarProducto, { rows: [], rowCount: 1 }]]);
  const antes = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test';
  t.after(() => {
    restore();
    if (antes === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = antes;
  });

  const res = await fetch(`${baseUrl}/products/khamrah`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken({ id: 1, role: 'ADMIN' })}` },
    body: JSON.stringify({ name: 'Khamrah', price: '390.00', stock: 5 }),
  });
  assert.equal(res.status, 200);

  // el aviso corre después de responder: se espera un momento a que haga la consulta
  for (let i = 0; i < 20 && !log.some((q) => Q.reclamar.test(q.sql)); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const reclamo = log.find((q) => Q.reclamar.test(q.sql));
  assert.ok(reclamo, 'debe revisar los avisos del perfume repuesto');
  assert.deepEqual(reclamo.params, [['khamrah']]);
});

// ── rate limit (va al final: usa los intentos que quedan) ──────────────────

test('el formulario tiene límite de intentos (429)', async (t) => {
  const { restore } = fakeDb([[Q.producto, agotado]]);
  t.after(restore);

  let status = 0;
  for (let i = 0; i < 10 && status !== 429; i += 1) {
    status = (await post('/restock-alerts', valido)).status;
  }
  assert.equal(status, 429);
});
