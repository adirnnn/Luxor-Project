import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { default: app } = await import('./server.js');

const USER_ID = 7;
const CART_ID = 55;
const token = signToken({ id: USER_ID, role: 'CLIENTE' });

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// Doble del pool de PostgreSQL

function fakeDb(routes) {
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

  return {
    log,
    restore: () => { pool.query = original.query; pool.connect = original.connect; },
  };
}

const ran = (log, re) => log.some((e) => re.test(e.sql));
const all = (log, re) => log.filter((e) => re.test(e.sql));
const first = (log, re) => log.find((e) => re.test(e.sql));
const posicion = (log, re) => log.findIndex((e) => re.test(e.sql));

// Patrones de las consultas que emiten las rutas.
const Q = {
  begin: /^BEGIN$/,
  commit: /^COMMIT$/,
  rollback: /^ROLLBACK$/,
  buscarCarrito: /FROM carts WHERE user_id/i,
  crearCarrito: /INSERT INTO carts/i,
  itemsConProducto: /FROM cart_items ci/i,
  borrarItems: /DELETE FROM cart_items/i,
  insertarItem: /INSERT INTO cart_items/i,
  descontarStock: /UPDATE products SET stock/i,
  crearOrden: /INSERT INTO orders/i,
  renglonOrden: /INSERT INTO order_items/i,
  registrarPago: /INSERT INTO payments/i,
  crearTabla: /^CREATE TABLE/i,
};

// El carrito existe y la tabla de pagos ya está creada: base de los casos de checkout.
const BASE = [
  [Q.crearTabla, { rows: [] }],
  [Q.buscarCarrito, { rows: [{ id: CART_ID }] }],
];

const pedir = (metodo, ruta, body) =>
  fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

// SFTWRKEY-445: el checkout ya no lleva datos de tarjeta
const checkout = (body = {}) => pedir('POST', `/checkout/${USER_ID}`, body);
const sincronizarCarrito = (items) => pedir('POST', `/cart/${USER_ID}`, items);

// Carrito vacío al hacer checkout 
test('checkout: carrito sin renglones responde 400 EMPTY_CART sin abrir transacción', async (t) => {
  const { log, restore } = fakeDb([
    ...BASE,
    [Q.itemsConProducto, { rows: [] }], // el carrito existe pero quedó vacío
  ]);
  t.after(restore);

  const res = await checkout();
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.code, 'EMPTY_CART');

  // No se cobra ni se crea nada.
  assert.equal(ran(log, Q.begin), false, 'no debe abrirse una transacción');
  assert.equal(ran(log, Q.crearOrden), false, 'no debe crearse una orden');
  assert.equal(ran(log, Q.descontarStock), false, 'no debe tocarse el stock');
});

test('checkout: usuario sin carrito registrado responde 400 EMPTY_CART', async (t) => {
  const { log, restore } = fakeDb([
    [Q.crearTabla, { rows: [] }],
    [Q.buscarCarrito, { rows: [] }], // nunca tuvo carrito
  ]);
  t.after(restore);

  const res = await checkout();
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.code, 'EMPTY_CART');
  assert.equal(ran(log, Q.crearOrden), false);
});

test('COR-2 carrito: si falla un renglón al sincronizar, se revierte todo', async (t) => {
  let insertados = 0;
  const { log, restore } = fakeDb([
    // SFTWRKEY-456: el carrito se crea o se toma con INSERT ... ON CONFLICT ... RETURNING id
    [Q.crearCarrito, { rows: [{ id: CART_ID }] }],
    [Q.borrarItems, { rows: [] }],
    [Q.insertarItem, () => {
      insertados += 1;
      if (insertados === 2) {
        throw Object.assign(
          new Error('insert or update on table "cart_items" violates foreign key constraint'),
          { code: '23503' }
        );
      }
      return { rows: [] };
    }],
  ]);
  t.after(restore);

  const res = await sincronizarCarrito([
    { product_id: 'khamrah', quantity: 2 },
    { product_id: 'producto-fantasma', quantity: 1 },
    { product_id: 'asad', quantity: 3 },
  ]);

  assert.equal(res.status, 500);

  // Éste es el fix de COR-2: el DELETE y el primer INSERT quedaron dentro de una
  // transacción que se revierte, así que el carrito NO queda modificado a medias.
  assert.equal(ran(log, Q.begin), true, 'la sincronización debe abrir una transacción');
  assert.equal(ran(log, Q.rollback), true, 'debe revertirse al fallar un renglón');
  assert.equal(ran(log, Q.commit), false, 'no debe confirmarse una sincronización incompleta');

  // El DELETE que vacía el carrito tiene que estar dentro de la transacción: si
  // quedara fuera, el carrito se perdería aunque la sincronización falle.
  assert.ok(posicion(log, Q.begin) < posicion(log, Q.borrarItems),
    'el DELETE debe ejecutarse después del BEGIN');
  assert.equal(insertados, 2, 'debe cortarse en el renglón que falla');
});

test('COR-2 carrito: si falla al crear el carrito del usuario, no queda nada a medias', async (t) => {
  const { log, restore } = fakeDb([
    // usuario nuevo, hay que crearle carrito
    [Q.crearCarrito, () => { throw new Error('no se pudo crear el carrito'); }],
  ]);
  t.after(restore);

  const res = await sincronizarCarrito([{ product_id: 'khamrah', quantity: 1 }]);

  assert.equal(res.status, 500);
  assert.equal(ran(log, Q.begin), true);
  assert.equal(ran(log, Q.rollback), true);
  assert.equal(ran(log, Q.commit), false);
});

test('carrito: sincronizar items válidos reemplaza el contenido y confirma', async (t) => {
  const { log, restore } = fakeDb([
    [Q.crearCarrito, { rows: [{ id: CART_ID }] }],
    [Q.borrarItems, { rows: [] }],
    [Q.insertarItem, { rows: [] }],
  ]);
  t.after(restore);

  const res = await sincronizarCarrito([
    { product_id: 'khamrah', quantity: 2 },
    { product_id: 'asad', quantity: 1 },
  ]);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(ran(log, Q.commit), true);
  assert.equal(ran(log, Q.rollback), false);

  const inserts = all(log, Q.insertarItem);
  assert.deepEqual(inserts.map((e) => e.params), [
    [CART_ID, 'khamrah', 2],
    [CART_ID, 'asad', 1],
  ]);
});

test('carrito: GET devuelve los items del usuario', async (t) => {
  const { restore } = fakeDb([
    [Q.buscarCarrito, { rows: [{ id: CART_ID }] }],
    [/SELECT product_id, quantity FROM cart_items/i, {
      rows: [{ product_id: 'khamrah', quantity: 2 }],
    }],
  ]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/cart/${USER_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body, [{ product_id: 'khamrah', quantity: 2 }]);
});

test('carrito: GET de un usuario sin carrito devuelve una lista vacía', async (t) => {
  const { restore } = fakeDb([[Q.buscarCarrito, { rows: [] }]]);
  t.after(restore);

  const res = await fetch(`${baseUrl}/cart/${USER_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});


test('carrito y checkout exigen autenticación', async (t) => {
  const { restore } = fakeDb(BASE);
  t.after(restore);

  const sinToken = await fetch(`${baseUrl}/cart/${USER_ID}`);
  assert.equal(sinToken.status, 401);

  const checkoutSinToken = await fetch(`${baseUrl}/checkout/${USER_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(checkoutSinToken.status, 401);
});

test('un cliente no puede hacer checkout del carrito de otro usuario (IDOR)', async (t) => {
  const { log, restore } = fakeDb(BASE);
  t.after(restore);

  const res = await pedir('POST', '/checkout/999', {}); // el token es del 7
  const body = await res.json();

  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.equal(log.length, 0, 'no debe tocarse la base si el acceso está denegado');
});
