// SFTWRKEY-431: reseñas y calificaciones. Solo quien recibió el perfume puede reseñarlo y el
// promedio del perfume se recalcula al publicar u ocultar una reseña.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { default: app } = await import('./server.js');
const { publicName, validateReview, COMMENT_MAX_LENGTH } = await import('./routes/reviews.js');

let server;
let baseUrl;

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

const Q = {
  compra: /FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.id = \$1 AND oi.product_id = \$2/i,
  insertar: /^INSERT INTO reviews/i,
  promedio: /^UPDATE products p SET rating_count/i,
  ocultar: /^UPDATE reviews SET hidden/i,
  publicas: /FROM reviews r JOIN users u/i,
  resumen: /SELECT rating_avg, rating_count FROM products WHERE id = \$1/i,
  adminLista: /FROM reviews r LEFT JOIN products p/i,
  adminTotal: /SELECT COUNT\(\*\)::int AS total FROM reviews r/i,
  mias: /FROM reviews WHERE user_id = \$1/i,
};

const CLIENTE = signToken({ id: 7, role: 'CLIENTE' });
const ADMIN = signToken({ id: 1, role: 'ADMIN' });

const RESENA = { id: 3, order_id: 15, product_id: 'khamrah', rating: 5, comment: 'Me encantó', hidden: false, created_at: '2026-10-25T10:00:00Z' };

// el cliente 7 recibió el pedido 15, que trae Khamrah
const compraEntregada = (estado = 'entregado', dueno = 7) => [Q.compra, { rows: [{ user_id: dueno, status: estado }] }];
const insertOk = [Q.insertar, (params) => ({ rows: [{ ...RESENA, rating: params[3], comment: params[4] }], rowCount: 1 })];
const promedioNuevo = [Q.promedio, { rows: [{ rating_avg: '4.50', rating_count: 2 }], rowCount: 1 }];

const publicar = (body, token = CLIENTE) =>
  fetch(`${baseUrl}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const ocultar = (id, hidden, token = ADMIN) =>
  fetch(`${baseUrl}/admin/reviews/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ hidden }),
  });

const VALIDA = { orderId: 15, productId: 'khamrah', rating: 5, comment: 'Me encantó' };
const sqls = (log, pattern) => log.filter((e) => pattern.test(e.sql));

// ── Quién puede reseñar ──────────────────────────────────────────────────────

test('sin sesión no se puede reseñar (401) y no se consulta la base', async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), insertOk, promedioNuevo]);
  t.after(restore);

  const res = await publicar(VALIDA, null);
  assert.equal(res.status, 401);
  assert.equal(log.length, 0);
});

test('quien no compró el perfume no puede reseñarlo (403) y no se guarda nada', async (t) => {
  // el pedido 15 no trae ese perfume (o no existe): la consulta de compra no devuelve filas
  const { log, restore } = fakeDb([[Q.compra, { rows: [] }], insertOk, promedioNuevo]);
  t.after(restore);

  const res = await publicar({ ...VALIDA, productId: 'yara' });
  const body = await res.json();

  assert.equal(res.status, 403);
  assert.match(body.message, /solo puedes calificar perfumes que compraste/i);
  assert.equal(sqls(log, Q.insertar).length, 0, 'no se inserta la reseña');
  assert.equal(sqls(log, Q.promedio).length, 0, 'no se toca el promedio');
  assert.equal(log.at(-1).sql, 'ROLLBACK');
});

test('no se puede reseñar con el pedido de otro cliente (403), con el mismo mensaje', async (t) => {
  const { log, restore } = fakeDb([compraEntregada('entregado', 99), insertOk, promedioNuevo]);
  t.after(restore);

  const res = await publicar(VALIDA);
  assert.equal(res.status, 403);
  assert.match((await res.json()).message, /solo puedes calificar perfumes que compraste/i);
  assert.equal(sqls(log, Q.insertar).length, 0);
});

test('un pedido que todavía no se entregó no se puede reseñar (403)', async (t) => {
  for (const estado of ['pagado', 'en_preparacion', 'enviado', 'cancelado']) {
    const { log, restore } = fakeDb([compraEntregada(estado), insertOk, promedioNuevo]);
    try {
      const res = await publicar(VALIDA);
      assert.equal(res.status, 403, estado);
      assert.match((await res.json()).message, /cuando tu pedido esté entregado/i);
      assert.equal(sqls(log, Q.insertar).length, 0, estado);
    } finally {
      restore();
    }
  }
});

test('la compra se busca con el pedido y el perfume que manda el cliente', async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), insertOk, promedioNuevo]);
  t.after(restore);

  await publicar(VALIDA);
  assert.deepEqual(sqls(log, Q.compra)[0].params, [15, 'khamrah']);
});

// ── Publicar ─────────────────────────────────────────────────────────────────

test('el cliente que recibió el perfume publica su reseña (201) y el promedio se recalcula en la misma transacción', async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), insertOk, promedioNuevo]);
  t.after(restore);

  const res = await publicar({ ...VALIDA, comment: '  Me encantó  ' });
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.review.rating, 5);
  assert.deepEqual(body.rating, { average: 4.5, count: 2 });
  // el user_id sale del token, no del cuerpo; el comentario se guarda sin espacios sobrantes
  assert.deepEqual(sqls(log, Q.insertar)[0].params, [15, 'khamrah', 7, 5, 'Me encantó']);
  assert.deepEqual(sqls(log, Q.promedio)[0].params, ['khamrah']);
  assert.deepEqual(
    log.map((e) => e.sql.split(' ')[0]),
    ['BEGIN', 'SELECT', 'INSERT', 'UPDATE', 'COMMIT'],
    'el promedio se actualiza antes del COMMIT'
  );
});

test('el comentario es opcional: vacío o solo espacios se guarda como NULL', async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), insertOk, promedioNuevo]);
  t.after(restore);

  assert.equal((await publicar({ orderId: 15, productId: 'khamrah', rating: 4 })).status, 201);
  assert.equal((await publicar({ ...VALIDA, comment: '   ' })).status, 201);
  const inserts = sqls(log, Q.insertar);
  assert.equal(inserts[0].params[4], null);
  assert.equal(inserts[1].params[4], null);
});

test('un comentario con HTML se guarda tal cual: se muestra como texto en React', async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), insertOk, promedioNuevo]);
  t.after(restore);

  const html = '<img src=x onerror="alert(1)">';
  const res = await publicar({ ...VALIDA, comment: html });
  assert.equal(res.status, 201);
  assert.equal(sqls(log, Q.insertar)[0].params[4], html);
});

test('una sola reseña por perfume de cada pedido: la segunda responde 409 y no cambia el promedio', async (t) => {
  // ON CONFLICT DO NOTHING no devuelve filas cuando ya existía
  const { log, restore } = fakeDb([compraEntregada(), [Q.insertar, { rows: [], rowCount: 0 }], promedioNuevo]);
  t.after(restore);

  const res = await publicar(VALIDA);
  assert.equal(res.status, 409);
  assert.match((await res.json()).message, /ya calificaste/i);
  assert.equal(sqls(log, Q.promedio).length, 0);
  assert.equal(log.at(-1).sql, 'ROLLBACK');
});

test('si la base falla se hace ROLLBACK y no se filtra el error interno', async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), [Q.insertar, () => { throw new Error('relation "reviews" does not exist'); }]]);
  t.after(restore);

  const res = await publicar(VALIDA);
  const body = await res.json();
  assert.equal(res.status, 500);
  assert.doesNotMatch(body.message, /relation/);
  assert.equal(log.at(-1).sql, 'ROLLBACK');
});

// ── Validación ───────────────────────────────────────────────────────────────

test('calificación fuera de 1 a 5, decimal o como texto: 400 sin tocar la base', async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), insertOk, promedioNuevo]);
  t.after(restore);

  for (const rating of [0, 6, -1, 4.5, '5', null, undefined]) {
    const res = await publicar({ ...VALIDA, rating });
    assert.equal(res.status, 400, `rating ${rating}`);
  }
  assert.equal(log.length, 0);
});

test(`el comentario tiene límite de ${COMMENT_MAX_LENGTH} caracteres`, async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), insertOk, promedioNuevo]);
  t.after(restore);

  const largo = await publicar({ ...VALIDA, comment: 'a'.repeat(COMMENT_MAX_LENGTH + 1) });
  assert.equal(largo.status, 400);
  assert.match((await largo.json()).message, /hasta 500 caracteres/);
  assert.equal(log.length, 0);

  // se cuentan caracteres, no unidades UTF-16: 500 emojis caben igual que en VARCHAR(500)
  assert.equal((await publicar({ ...VALIDA, comment: 'a'.repeat(COMMENT_MAX_LENGTH) })).status, 201);
  assert.equal((await publicar({ ...VALIDA, comment: '🌹'.repeat(COMMENT_MAX_LENGTH) })).status, 201);
});

test('pedido o perfume inválidos, o comentario que no es texto: 400', async (t) => {
  const { log, restore } = fakeDb([compraEntregada(), insertOk, promedioNuevo]);
  t.after(restore);

  for (const body of [
    { ...VALIDA, orderId: 'abc' },
    { ...VALIDA, orderId: 0 },
    { ...VALIDA, orderId: undefined },
    { ...VALIDA, productId: '' },
    { ...VALIDA, productId: 123 },
    { ...VALIDA, comment: { texto: 'x' } },
  ]) {
    assert.equal((await publicar(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(log.length, 0);
});

// ── Lectura pública ──────────────────────────────────────────────────────────

test('la ficha recibe solo las reseñas visibles, con el promedio y sin datos personales', async (t) => {
  const { log, restore } = fakeDb([
    [Q.resumen, { rows: [{ rating_avg: '4.50', rating_count: 2 }] }],
    [Q.publicas, { rows: [
      { id: 4, rating: 4, comment: 'Dura mucho', created_at: '2026-10-26', user_name: 'María García López', user_email: 'maria@luxor.com', user_id: 7 },
      { id: 3, rating: 5, comment: null, created_at: '2026-10-25', user_name: 'Carlos', user_email: 'c@luxor.com', user_id: 8 },
    ] }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/products/khamrah/reviews`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.average, 4.5);
  assert.equal(body.count, 2);
  assert.deepEqual(body.reviews.map((r) => r.author), ['María G.', 'Carlos']);
  assert.deepEqual(Object.keys(body.reviews[0]).sort(), ['author', 'comment', 'created_at', 'id', 'rating']);
  assert.match(sqls(log, Q.publicas)[0].sql, /r\.hidden = FALSE/);
});

test('las reseñas de un perfume que no existe responden 404', async (t) => {
  const { restore } = fakeDb([[Q.resumen, { rows: [] }]]);
  t.after(restore);

  assert.equal((await fetch(`${baseUrl}/products/no-existe/reviews`)).status, 404);
});

test('un perfume sin reseñas tiene promedio null y cantidad 0', async (t) => {
  const { restore } = fakeDb([[Q.resumen, { rows: [{ rating_avg: null, rating_count: 0 }] }]]);
  t.after(restore);

  const body = await (await fetch(`${baseUrl}/products/khamrah/reviews`)).json();
  assert.equal(body.average, null);
  assert.equal(body.count, 0);
  assert.deepEqual(body.reviews, []);
});

// ── Mis reseñas ──────────────────────────────────────────────────────────────

test('el cliente ve sus reseñas, pero no las de otro (403)', async (t) => {
  const { log, restore } = fakeDb([[Q.mias, { rows: [RESENA] }]]);
  t.after(restore);

  const propias = await fetch(`${baseUrl}/user/7/reviews`, { headers: { Authorization: `Bearer ${CLIENTE}` } });
  assert.equal(propias.status, 200);
  assert.equal(propias.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await propias.json()).reviews, [RESENA]);

  const ajenas = await fetch(`${baseUrl}/user/8/reviews`, { headers: { Authorization: `Bearer ${CLIENTE}` } });
  assert.equal(ajenas.status, 403);
  assert.equal(sqls(log, Q.mias).length, 1);
});

// ── Admin ────────────────────────────────────────────────────────────────────

test('el admin oculta una reseña y el promedio del perfume se recalcula en la misma transacción', async (t) => {
  const { log, restore } = fakeDb([
    [Q.ocultar, (params) => ({ rows: [{ ...RESENA, hidden: params[0] }], rowCount: 1 })],
    [Q.promedio, { rows: [{ rating_avg: '4.00', rating_count: 1 }], rowCount: 1 }],
  ]);
  t.after(restore);

  const res = await ocultar(3, true);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.review.hidden, true);
  assert.deepEqual(body.rating, { average: 4, count: 1 });
  assert.deepEqual(sqls(log, Q.ocultar)[0].params, [true, 3]);
  assert.deepEqual(sqls(log, Q.promedio)[0].params, ['khamrah']);
  assert.deepEqual(log.map((e) => e.sql.split(' ')[0]), ['BEGIN', 'UPDATE', 'UPDATE', 'COMMIT']);
});

test('el admin vuelve a mostrar una reseña y el promedio también se recalcula', async (t) => {
  const { log, restore } = fakeDb([
    [Q.ocultar, (params) => ({ rows: [{ ...RESENA, hidden: params[0] }], rowCount: 1 })],
    promedioNuevo,
  ]);
  t.after(restore);

  const res = await ocultar(3, false);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).rating, { average: 4.5, count: 2 });
  assert.deepEqual(sqls(log, Q.ocultar)[0].params, [false, 3]);
  assert.equal(sqls(log, Q.promedio).length, 1);
});

test('si la última reseña visible se oculta, el promedio queda en null y la cantidad en 0', async (t) => {
  const { restore } = fakeDb([
    [Q.ocultar, { rows: [{ ...RESENA, hidden: true }], rowCount: 1 }],
    [Q.promedio, { rows: [{ rating_avg: null, rating_count: 0 }], rowCount: 1 }],
  ]);
  t.after(restore);

  assert.deepEqual((await (await ocultar(3, true)).json()).rating, { average: null, count: 0 });
});

test('un cliente no puede ocultar reseñas (403) y sin sesión 401', async (t) => {
  const { log, restore } = fakeDb([[Q.ocultar, { rows: [RESENA], rowCount: 1 }]]);
  t.after(restore);

  assert.equal((await ocultar(3, true, CLIENTE)).status, 403);
  assert.equal((await ocultar(3, true, null)).status, 401);
  assert.equal(log.length, 0);
});

test('ocultar: id inválido o hidden que no es booleano da 400; reseña inexistente 404', async (t) => {
  const { log, restore } = fakeDb([[Q.ocultar, { rows: [], rowCount: 0 }]]);
  t.after(restore);

  assert.equal((await ocultar('abc', true)).status, 400);
  assert.equal((await ocultar(3, 'si')).status, 400);
  assert.equal(log.length, 0);

  assert.equal((await ocultar(99, true)).status, 404);
  assert.equal(sqls(log, Q.promedio).length, 0);
  assert.equal(log.at(-1).sql, 'ROLLBACK');
});

test('lista del admin: filtra por visibles u ocultas y pagina', async (t) => {
  const { log, restore } = fakeDb([
    [Q.adminTotal, { rows: [{ total: 1 }] }],
    [Q.adminLista, { rows: [{ ...RESENA, hidden: true, product_name: null, user_name: 'Ana', user_email: 'ana@luxor.com' }] }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/admin/reviews?status=hidden&page=2&limit=10`, { headers: { Authorization: `Bearer ${ADMIN}` } });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.total, 1);
  assert.equal(body.reviews[0].product_name, 'khamrah', 'un perfume borrado se muestra con su id');
  assert.deepEqual(sqls(log, Q.adminLista)[0].params, [true, 10, 10]);
  assert.deepEqual(sqls(log, Q.adminTotal)[0].params, [true]);
});

test('lista del admin: filtro o paginación inválidos dan 400 y un cliente recibe 403', async (t) => {
  const { log, restore } = fakeDb();
  t.after(restore);

  const pedir = (qs, token = ADMIN) => fetch(`${baseUrl}/admin/reviews${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await pedir('?status=borradas')).status, 400);
  assert.equal((await pedir('?page=0')).status, 400);
  assert.equal((await pedir('?limit=51')).status, 400);
  assert.equal((await pedir('', CLIENTE)).status, 403);
  assert.equal(log.length, 0);
});

// ── Funciones sueltas ────────────────────────────────────────────────────────

test('publicName: nombre y la inicial del apellido', () => {
  assert.equal(publicName('María García López'), 'María G.');
  assert.equal(publicName('  carlos   lópez '), 'carlos L.');
  assert.equal(publicName('Ana'), 'Ana');
  assert.equal(publicName(''), 'Cliente');
  assert.equal(publicName(null), 'Cliente');
});

test('validateReview: normaliza el pedido, el perfume y el comentario', () => {
  assert.deepEqual(validateReview({ orderId: '15', productId: ' khamrah ', rating: 3, comment: ' hola ' }).value, {
    orderId: 15, productId: 'khamrah', rating: 3, comment: 'hola',
  });
  assert.ok(validateReview(undefined).error);
});
