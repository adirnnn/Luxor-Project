import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';
process.env.PERFUM_API_BASE_URL = 'https://fake-perfumapi.test';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { default: app } = await import('./server.js');
const { CSV_TEMPLATE } = await import('./csvImport.js');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Doble del pool de PostgreSQL
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

// Doble del `fetch` global: solo intercepta llamadas a PerfumAPI, todo lo
// demás (incluidas las peticiones de los tests a nuestro propio servidor)
// pasa de largo hacia el fetch real.
function fakeExternalApi(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = (url, opts) => {
    const href = typeof url === 'string' ? url : url.toString();
    if (href.startsWith(process.env.PERFUM_API_BASE_URL)) {
      return handler(href, opts);
    }
    return original(url, opts);
  };
  return () => { globalThis.fetch = original; };
}

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const adminToken = signToken({ id: 1, role: 'ADMIN' });
const pedir = (metodo, ruta, body) =>
  fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const Q = {
  usuarioPorId: /FROM users u JOIN rol r[\s\S]*WHERE u\.id = \$1/i,
  actualizarUsuario: /^UPDATE users SET name = \$1, email = \$2 WHERE id = \$3/i,
  passwordDelUsuario: /^SELECT password FROM users WHERE id = \$1$/i,
  actualizarPassword: /^UPDATE users SET password = \$1 WHERE id = \$2$/i,
  buscarUsuarios: /WHERE u\.name ILIKE \$1 OR u\.email ILIKE \$1/i,
  pedidosDelUsuario: /FROM orders\s+WHERE user_id = \$1/i,
  itemsDelPedido: /FROM order_items oi/i,
  syncLogs: /FROM perfum_api_sync_logs/i,
  insertarSyncLog: /^INSERT INTO perfum_api_sync_logs/i,
  historialImportaciones: /FROM product_imports ORDER BY created_at DESC/i,
  insertarHistorialImportacion: /^INSERT INTO product_imports/i,
  productosExistentesPorId: /SELECT id FROM products WHERE id = ANY/i,
  insertarProducto: /^INSERT INTO products/i,
  totalUsuarios: /SELECT COUNT\(\*\) as total FROM users/i,
  totalItemsCarrito: /SELECT SUM\(quantity\) as total FROM cart_items/i,
  topDelReporteViejo: /FROM order_items oi\s+JOIN orders o/i,
  chatbotInsert: /^INSERT INTO chatbot_queries/i,
  metricasGenerales: /\(SELECT COUNT\(\*\) FROM users\) AS total_users/i,
  ventasPorCategoria: /FROM order_items oi[\s\S]*LEFT JOIN categories c ON c\.id = p\.category_id[\s\S]*GROUP BY 1\s+ORDER BY revenue DESC/i,
  topProductosNuevo: /GROUP BY p\.id, p\.name, c\.nombre/i,
  inventarioPorCategoria: /FROM products p\s+LEFT JOIN categories c ON c\.id = p\.category_id/i,
  ventasMensuales: /FROM orders\s+WHERE status = 'completed'\s+AND created_at/i,
};

// ── PUT /user/:userId ────────────────────────────────────────────────────────

test('PUT /user/:userId: sin nombre o correo responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('PUT', '/user/1', { name: 'Ana' });
  assert.equal(res.status, 400);
});

test('PUT /user/:userId: correo con formato inválido responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('PUT', '/user/1', { name: 'Ana', email: 'no-es-un-correo' });
  assert.equal(res.status, 400);
});

test('PUT /user/:userId: usuario inexistente responde 404', async (t) => {
  const { restore } = fakeDb([[Q.actualizarUsuario, { rows: [] }]]);
  t.after(restore);
  const res = await pedir('PUT', '/user/999', { name: 'Ana', email: 'ana@luxor.com' });
  assert.equal(res.status, 404);
});

test('PUT /user/:userId: correo duplicado (unique_violation) responde 409', async (t) => {
  const duplicate = Object.assign(new Error('duplicate key'), { code: '23505' });
  const { restore } = fakeDb([[Q.actualizarUsuario, () => { throw duplicate; }]]);
  t.after(restore);
  const res = await pedir('PUT', '/user/1', { name: 'Ana', email: 'ana@luxor.com' });
  assert.equal(res.status, 409);
});

test('PUT /user/:userId: actualización válida responde 200 con el usuario actualizado', async (t) => {
  const { log, restore } = fakeDb([
    [Q.actualizarUsuario, { rows: [{ id: '1', name: 'Ana', email: 'ana@luxor.com' }] }],
  ]);
  t.after(restore);
  const res = await pedir('PUT', '/user/1', { name: 'Ana', email: 'ana@luxor.com' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.user.email, 'ana@luxor.com');
  assert.deepEqual(log[0].params, ['Ana', 'ana@luxor.com', '1']);
});

// ── PUT /user/:userId/password ──────────────────────────────────────────────

test('PUT /user/:userId/password: sin currentPassword/newPassword responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('PUT', '/user/1/password', { currentPassword: 'a' });
  assert.equal(res.status, 400);
});

test('PUT /user/:userId/password: contraseña nueva muy corta responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('PUT', '/user/1/password', { currentPassword: 'actual123', newPassword: 'abc' });
  assert.equal(res.status, 400);
});

test('PUT /user/:userId/password: usuario inexistente responde 404', async (t) => {
  const { restore } = fakeDb([[Q.passwordDelUsuario, { rows: [] }]]);
  t.after(restore);
  const res = await pedir('PUT', '/user/999/password', { currentPassword: 'actual123', newPassword: 'nuevo123' });
  assert.equal(res.status, 404);
});

test('PUT /user/:userId/password: contraseña actual incorrecta responde 401', async (t) => {
  const bcrypt = (await import('bcryptjs')).default;
  const hashReal = await bcrypt.hash('la-correcta', 12);
  const { restore } = fakeDb([[Q.passwordDelUsuario, { rows: [{ password: hashReal }] }]]);
  t.after(restore);
  const res = await pedir('PUT', '/user/1/password', { currentPassword: 'otra-cosa', newPassword: 'nuevo123' });
  assert.equal(res.status, 401);
});

test('PUT /user/:userId/password: cambio válido responde 200', async (t) => {
  const bcrypt = (await import('bcryptjs')).default;
  const hashReal = await bcrypt.hash('la-correcta', 12);
  const { log, restore } = fakeDb([
    [Q.passwordDelUsuario, { rows: [{ password: hashReal }] }],
    [Q.actualizarPassword, { rows: [], rowCount: 1 }],
  ]);
  t.after(restore);
  const res = await pedir('PUT', '/user/1/password', { currentPassword: 'la-correcta', newPassword: 'nuevo123' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(log.at(-1).params[1], '1');
});

// ── GET /users/search ────────────────────────────────────────────────────────

test('GET /users/search: sin "q" responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await fetch(`${baseUrl}/users/search`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(res.status, 400);
});

test('GET /users/search: devuelve coincidencias por nombre o correo', async (t) => {
  const { log, restore } = fakeDb([
    [Q.buscarUsuarios, { rows: [{ id: '2', name: 'Ana', email: 'ana@luxor.com', role: 'CLIENTE' }] }],
  ]);
  t.after(restore);
  const res = await fetch(`${baseUrl}/users/search?q=ana`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.users.length, 1);
  assert.deepEqual(log[0].params, ['%ana%']);
});

// ── GET /user/:userId/orders ─────────────────────────────────────────────────

test('GET /user/:userId/orders: arma cada pedido con sus renglones (items)', async (t) => {
  const { restore } = fakeDb([
    [Q.pedidosDelUsuario, { rows: [{ id: 'o1', total: '390.00', status: 'completed', created_at: '2026-01-01' }] }],
    [Q.itemsDelPedido, { rows: [{ product_id: 'khamrah', quantity: 1, unit_price: '390.00', name: 'Khamrah', image: 'khamrah.png' }] }],
  ]);
  t.after(restore);
  const res = await fetch(`${baseUrl}/user/1/orders`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.orders.length, 1);
  assert.equal(body.orders[0].items.length, 1);
  assert.equal(body.orders[0].items[0].product_id, 'khamrah');
});

test('GET /user/:userId/orders: usuario sin pedidos devuelve un arreglo vacío', async (t) => {
  const { restore } = fakeDb([[Q.pedidosDelUsuario, { rows: [] }]]);
  t.after(restore);
  const res = await fetch(`${baseUrl}/user/1/orders`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.orders, []);
});

// ── GET /report (resumen viejo) ──────────────────────────────────────────────

test('GET /report: arma el resumen de usuarios, carritos y top productos', async (t) => {
  const { restore } = fakeDb([
    [Q.totalUsuarios, { rows: [{ total: '42' }] }],
    [Q.totalItemsCarrito, { rows: [{ total: '15' }] }],
    [Q.topDelReporteViejo, { rows: [{ product_id: 'khamrah', total_quantity: '9' }] }],
  ]);
  t.after(restore);
  const res = await pedir('GET', '/report');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.data, {
    totalUsers: 42,
    totalItemsInCarts: 15,
    topProducts: [{ product_id: 'khamrah', total_quantity: '9' }],
  });
});

test('GET /report: sin items en carritos (SUM null) cae a 0 en vez de NaN', async (t) => {
  const { restore } = fakeDb([
    [Q.totalUsuarios, { rows: [{ total: '0' }] }],
    [Q.totalItemsCarrito, { rows: [{ total: null }] }],
    [Q.topDelReporteViejo, { rows: [] }],
  ]);
  t.after(restore);
  const res = await pedir('GET', '/report');
  const body = await res.json();
  assert.equal(body.data.totalItemsInCarts, 0);
});

test('GET /report: error de base responde 500', async (t) => {
  const { restore } = fakeDb([[Q.totalUsuarios, () => { throw new Error('fallo'); }]]);
  t.after(restore);
  const res = await pedir('GET', '/report');
  assert.equal(res.status, 500);
});

// ── GET /report/metrics, /report/sales-by-category, /report/inventory ──────
// (delegan en reportMetrics.js, ya probado a nivel unitario en la tarea 1;
// aquí solo confirmamos que el endpoint está bien conectado)

test('GET /report/metrics: expone las métricas generales', async (t) => {
  const { restore } = fakeDb([[Q.metricasGenerales, { rows: [{
    total_users: '1', total_products: '1', total_orders: '1', total_revenue: '1', total_units_sold: '1', total_stock: '1',
  }] }]]);
  t.after(restore);
  const res = await pedir('GET', '/report/metrics');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.metrics.totalUsers, 1);
});

test('GET /report/sales-by-category: expone las ventas agrupadas', async (t) => {
  const { restore } = fakeDb([[Q.ventasPorCategoria, { rows: [{ category: 'Árabes', units: '3', revenue: '900.00' }] }]]);
  t.after(restore);
  const res = await pedir('GET', '/report/sales-by-category');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.sales[0].category, 'Árabes');
});

test('GET /report/inventory: expone el inventario por categoría', async (t) => {
  const { restore } = fakeDb([[Q.inventarioPorCategoria, { rows: [{ category: 'Árabes', products: '4', stock: '80' }] }]]);
  t.after(restore);
  const res = await pedir('GET', '/report/inventory');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.inventory[0].stock, 80);
});

// ── GET /report/sales-monthly ────────────────────────────────────────────────

test('GET /report/sales-monthly: "months" no numérico responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('GET', '/report/sales-monthly?months=abc');
  assert.equal(res.status, 400);
});

test('GET /report/sales-monthly: "months" fuera de rango (0 o 37) responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const bajo = await pedir('GET', '/report/sales-monthly?months=0');
  assert.equal(bajo.status, 400);
  const alto = await pedir('GET', '/report/sales-monthly?months=37');
  assert.equal(alto.status, 400);
});

test('GET /report/sales-monthly: usa 12 meses por defecto y responde 200', async (t) => {
  const { log, restore } = fakeDb([[Q.ventasMensuales, { rows: [] }]]);
  t.after(restore);
  const res = await pedir('GET', '/report/sales-monthly');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.sales.length, 12);
  assert.deepEqual(log[0].params, [12]);
});

// ── GET /report/top-products ─────────────────────────────────────────────────

test('GET /report/top-products: "limit" fuera de rango responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('GET', '/report/top-products?limit=100');
  assert.equal(res.status, 400);
});

test('GET /report/top-products: usa 5 por defecto', async (t) => {
  const { log, restore } = fakeDb([[Q.topProductosNuevo, { rows: [] }]]);
  t.after(restore);
  const res = await pedir('GET', '/report/top-products');
  assert.equal(res.status, 200);
  assert.deepEqual(log[0].params, [5]);
});

// ── GET /external-perfumes/search ────────────────────────────────────────────

test('GET /external-perfumes/search: sin "q" responde 400 sin llamar a PerfumAPI', async (t) => {
  let llamadoExterno = false;
  const restoreFetch = fakeExternalApi(() => { llamadoExterno = true; return jsonResponse([]); });
  const { restore } = fakeDb();
  t.after(() => { restore(); restoreFetch(); });

  const res = await pedir('GET', '/external-perfumes/search');
  assert.equal(res.status, 400);
  assert.equal(llamadoExterno, false);
});

test('GET /external-perfumes/search: mapea, valida y filtra por marca los resultados de PerfumAPI', async (t) => {
  const restoreFetch = fakeExternalApi(() => jsonResponse([
    { id: 'ext-1', name: 'Khamrah', brand: 'Lattafa', notes_top: ['Canela'] },
    { id: 'ext-2', name: 'Otro', brand: 'Otra Marca', notes_top: ['Rosa'] },
  ]));
  const { restore } = fakeDb();
  t.after(() => { restore(); restoreFetch(); });

  const res = await pedir('GET', '/external-perfumes/search?q=kham&brand=Lattafa');
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].name, 'Khamrah');
});

test('GET /external-perfumes/search: descarta y registra los resultados sin nombre en vez de romper la respuesta', async (t) => {
  const restoreFetch = fakeExternalApi(() => jsonResponse([{ id: 'ext-1', name: '', brand: 'Lattafa' }]));
  const { log, restore } = fakeDb();
  t.after(() => { restore(); restoreFetch(); });

  const res = await pedir('GET', '/external-perfumes/search?q=kham');
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body.results, []);
  assert.ok(log.some((entry) => Q.insertarSyncLog.test(entry.sql)));
});

test('GET /external-perfumes/search: si PerfumAPI responde con error, contesta 502', async (t) => {
  const restoreFetch = fakeExternalApi(() => jsonResponse({ message: 'nope' }, 500));
  const { restore } = fakeDb();
  t.after(() => { restore(); restoreFetch(); });

  const res = await pedir('GET', '/external-perfumes/search?q=kham');
  assert.equal(res.status, 502);
});

// ── GET /external-perfumes/brands ────────────────────────────────────────────

test('GET /external-perfumes/brands: pagina el catálogo externo y devuelve marcas únicas y ordenadas', async (t) => {
  const restoreFetch = fakeExternalApi((href) => {
    if (href.includes('offset=0')) {
      return jsonResponse({ total: 2, perfumes: [{ brand: 'Lattafa' }, { brand: 'Armaf' }] });
    }
    return jsonResponse({ total: 2, perfumes: [] });
  });
  const { restore } = fakeDb();
  t.after(() => { restore(); restoreFetch(); });

  const res = await pedir('GET', '/external-perfumes/brands');
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body.brands, ['Armaf', 'Lattafa']);
});

// ── GET /admin/perfum-sync-logs ──────────────────────────────────────────────

test('GET /admin/perfum-sync-logs: devuelve el historial de errores de sincronización', async (t) => {
  const { restore } = fakeDb([
    [Q.syncLogs, { rows: [{ id: 1, query: 'kham', external_id: null, error_message: 'PerfumAPI respondio con estado 500' }] }],
  ]);
  t.after(restore);
  const res = await pedir('GET', '/admin/perfum-sync-logs');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.logs.length, 1);
});

// ── GET /imports/products/template ───────────────────────────────────────────

test('GET /imports/products/template: descarga la plantilla CSV', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('GET', '/imports/products/template');
  const texto = await res.text();
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/csv'));
  assert.equal(texto, CSV_TEMPLATE);
});

// ── GET /imports/products ────────────────────────────────────────────────────

test('GET /imports/products: devuelve el historial de importaciones', async (t) => {
  const { restore } = fakeDb([
    [Q.historialImportaciones, { rows: [{ id: 1, file_name: 'perfumes.csv', total_rows: 1, imported_rows: 1, rejected_rows: 0, errors: [] }] }],
  ]);
  t.after(restore);
  const res = await pedir('GET', '/imports/products');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.imports.length, 1);
});

// ── POST /imports/products ───────────────────────────────────────────────────

test('POST /imports/products: archivo sin extensión .csv responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('POST', '/imports/products', { fileName: 'perfumes.xlsx', csv: CSV_TEMPLATE });
  assert.equal(res.status, 400);
});

test('POST /imports/products: encabezados de columnas inválidos responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await pedir('POST', '/imports/products', { fileName: 'perfumes.csv', csv: 'a,b,c\n1,2,3' });
  assert.equal(res.status, 400);
});

test('POST /imports/products: fila con id que ya existe en la base se rechaza igual que un error de validación', async (t) => {
  const { restore } = fakeDb([
    [Q.productosExistentesPorId, { rows: [{ id: 'noir-oud' }] }],
    [Q.insertarHistorialImportacion, { rows: [{ id: 1, file_name: 'perfumes.csv', total_rows: 1, imported_rows: 0, rejected_rows: 1, errors: [] }] }],
  ]);
  t.after(restore);
  const res = await pedir('POST', '/imports/products', { fileName: 'perfumes.csv', csv: CSV_TEMPLATE });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.summary.imported_rows, 0);
});

test('POST /imports/products: importación válida inserta el producto y guarda el historial', async (t) => {
  const { log, restore } = fakeDb([
    [Q.productosExistentesPorId, { rows: [] }],
    [Q.insertarProducto, { rows: [], rowCount: 1 }],
    [Q.insertarHistorialImportacion, { rows: [{ id: 1, file_name: 'perfumes.csv', total_rows: 1, imported_rows: 1, rejected_rows: 0, errors: [] }] }],
  ]);
  t.after(restore);
  const res = await pedir('POST', '/imports/products', { fileName: 'perfumes.csv', csv: CSV_TEMPLATE });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.summary.imported_rows, 1);
  assert.ok(log.some((entry) => Q.insertarProducto.test(entry.sql)));
});

// ── POST /chatbot/queries (pública) ─────────────────────────────────────────

test('POST /chatbot/queries: sin "query" responde 400', async (t) => {
  const { restore } = fakeDb();
  t.after(restore);
  const res = await fetch(`${baseUrl}/chatbot/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test('POST /chatbot/queries: guarda la consulta y responde 201 sin requerir autenticación', async (t) => {
  const { log, restore } = fakeDb([
    [Q.chatbotInsert, { rows: [{ id: 1, query: '¿Tienen Khamrah?', response: null, created_at: '2026-01-01' }] }],
  ]);
  t.after(restore);
  const res = await fetch(`${baseUrl}/chatbot/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '¿Tienen Khamrah?' }),
  });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.query.query, '¿Tienen Khamrah?');
  assert.deepEqual(log.at(-1).params, ['¿Tienen Khamrah?', null]);
});