import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests'; // se lee al cargar el módulo

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

const TARJETA_VALIDA = {
  cardholderName: 'Ana Cliente',
  cardNumber: '4242 4242 4242 4242', // tarjeta de prueba que la pasarela aprueba
  expiryMonth: '12',
  expiryYear: '2030',
  cvv: '123',
  billingAddress: 'Zona 10',
  city: 'Guatemala',
  postalCode: '01010',
  country: 'Guatemala',
};

const pedir = (metodo, ruta, body) =>
  fetch(`${baseUrl}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

const checkout = (body = TARJETA_VALIDA) => pedir('POST', `/checkout/${USER_ID}`, body);
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

// Stock insuficiente al momento de comprar
test('checkout: stock insuficiente responde 409 y detalla qué falta', async (t) => {
  const { log, restore } = fakeDb([
    ...BASE,
    [Q.itemsConProducto, {
      rows: [
        { product_id: 'khamrah', quantity: 5, name: 'Lattafa Khamrah', price: '390.00', stock: 2 },
        { product_id: 'asad', quantity: 1, name: 'Lattafa Asad', price: '350.00', stock: 9 },
      ],
    }],
  ]);
  t.after(restore);

  const res = await checkout();
  const body = await res.json();

  assert.equal(res.status, 409);
  assert.equal(body.code, 'INSUFFICIENT_STOCK');
  assert.equal(body.items.length, 1, 'sólo debe listar el producto que no alcanza');
  assert.deepEqual(body.items[0], {
    product_id: 'khamrah', name: 'Lattafa Khamrah', disponible: 2, solicitado: 5,
  });

  // Se corta antes de cobrar y antes de abrir la transacción.
  assert.equal(ran(log, Q.begin), false);
  assert.equal(ran(log, Q.descontarStock), false);
});

test('checkout: pedir exactamente el stock disponible sí procede', async (t) => {
  // Frontera: quantity === stock no debe rechazarse (el chequeo es quantity > stock).
  const { log, restore } = fakeDb([
    ...BASE,
    [Q.itemsConProducto, {
      rows: [{ product_id: 'khamrah', quantity: 3, name: 'Khamrah', price: '100.00', stock: 3 }],
    }],
    [Q.descontarStock, { rows: [{ id: 'khamrah' }] }],
    [Q.crearOrden, { rows: [{ id: 910, created_at: '2026-01-01T00:00:00.000Z' }] }],
    [Q.registrarPago, { rows: [{ id: 1, order_id: 910, status: 'aprobado' }] }],
  ]);
  t.after(restore);

  const res = await checkout();

  assert.equal(res.status, 201);
  assert.equal(ran(log, Q.commit), true);
});

test('COR-2 checkout: si el stock se agota dentro de la transacción, revierte con 409', async (t) => {
  const { log, restore } = fakeDb([
    ...BASE,
    [Q.itemsConProducto, {
      rows: [{ product_id: 'khamrah', quantity: 3, name: 'Khamrah', price: '390.00', stock: 3 }],
    }],
    [Q.descontarStock, { rows: [] }], // 0 filas afectadas = ya no alcanza
    [Q.crearOrden, { rows: [{ id: 911, created_at: '2026-01-01T00:00:00.000Z' }] }],
  ]);
  t.after(restore);

  const res = await checkout();
  const body = await res.json();

  assert.equal(res.status, 409);
  assert.equal(body.code, 'INSUFFICIENT_STOCK');

  assert.match(first(log, Q.descontarStock).sql, /stock\s*>=\s*\$1/i,
    'el UPDATE de stock debe llevar la condición "stock >= cantidad" (COR-2)');

  // La transacción se abrió y se revirtió: no puede quedar una orden a medias.
  assert.equal(ran(log, Q.begin), true);
  assert.equal(ran(log, Q.rollback), true, 'debe revertirse la transacción');
  assert.equal(ran(log, Q.commit), false, 'no debe confirmarse nada');
  assert.equal(ran(log, Q.crearOrden), false, 'no debe llegar a crear la orden');
});

// Cálculo correcto del total de la orden 
test('checkout: el total se calcula desde el precio de la base, no desde el cliente', async (t) => {
  const { log, restore } = fakeDb([
    ...BASE,
    [Q.itemsConProducto, {
      rows: [
        { product_id: 'khamrah', quantity: 2, name: 'Khamrah', price: '390.50', stock: 10 },
        { product_id: 'asad', quantity: 3, name: 'Asad', price: '125.25', stock: 10 },
      ],
    }],
    [Q.descontarStock, { rows: [{ id: 'ok' }] }],
    [Q.crearOrden, { rows: [{ id: 900, created_at: '2026-01-01T00:00:00.000Z' }] }],
    [Q.registrarPago, { rows: [{ id: 1, order_id: 900, status: 'aprobado' }] }],
  ]);
  t.after(restore);

  // El cliente manda un total absurdo: debe ignorarse por completo.
  const res = await checkout({ ...TARJETA_VALIDA, total: 1, amount: 1 });
  const body = await res.json();

  const esperado = 2 * 390.50 + 3 * 125.25; 

  assert.equal(res.status, 201);
  assert.equal(body.order.total, esperado);
  assert.equal(typeof body.order.total, 'number', 'el total no debe ser un string concatenado');
  assert.equal(first(log, Q.crearOrden).params[1], esperado);
  assert.equal(first(log, Q.registrarPago).params[2], esperado);
});

// Creación de la orden y actualización del stock tras checkout exitoso 

test('checkout exitoso: descuenta stock, crea la orden con sus renglones, vacía el carrito y confirma', async (t) => {
  const items = [
    { product_id: 'khamrah', quantity: 2, name: 'Khamrah', price: '390.00', stock: 10 },
    { product_id: 'asad', quantity: 1, name: 'Asad', price: '350.00', stock: 4 },
  ];
  const { log, restore } = fakeDb([
    ...BASE,
    [Q.itemsConProducto, { rows: items }],
    [Q.descontarStock, { rows: [{ id: 'ok' }] }],
    [Q.crearOrden, { rows: [{ id: 901, created_at: '2026-01-01T00:00:00.000Z' }] }],
    [Q.registrarPago, { rows: [{ id: 33, order_id: 901, status: 'aprobado' }] }],
  ]);
  t.after(restore);

  const res = await checkout();
  const body = await res.json();

  // Respuesta que consume la pantalla de confirmación.
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.order.id, 901);
  assert.equal(body.order.total, 2 * 390 + 350);
  assert.equal(body.payment.status, 'aprobado');
  assert.equal(body.payment.last4, '4242');

  // Se descontó el stock de cada producto, con su cantidad exacta.
  const descuentos = all(log, Q.descontarStock);
  assert.equal(descuentos.length, 2);
  assert.deepEqual(descuentos.map((e) => e.params), [[2, 'khamrah'], [1, 'asad']]);

  assert.equal(first(log, Q.crearOrden).params[0], String(USER_ID));
  const renglones = all(log, Q.renglonOrden);
  assert.equal(renglones.length, 2);
  assert.deepEqual(renglones[0].params, [901, 'khamrah', 2, '390.00']);
  assert.deepEqual(renglones[1].params, [901, 'asad', 1, '350.00']);

  // Se vació el carrito y se registró el pago aprobado.
  assert.deepEqual(first(log, Q.borrarItems).params, [CART_ID]);
  assert.equal(first(log, Q.registrarPago).params[3], 'aprobado');

  // Todo ocurrió dentro de una transacción confirmada.
  assert.equal(ran(log, Q.commit), true);
  assert.equal(ran(log, Q.rollback), false);

  assert.ok(posicion(log, Q.begin) < posicion(log, Q.descontarStock),
    'el stock debe descontarse dentro de la transacción');
  assert.ok(posicion(log, Q.crearOrden) < posicion(log, Q.commit),
    'la orden debe crearse antes del COMMIT');
});


test('COR-2 carrito: si falla un renglón al sincronizar, se revierte todo', async (t) => {
  let insertados = 0;
  const { log, restore } = fakeDb([
    [Q.buscarCarrito, { rows: [{ id: CART_ID }] }],
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
    [Q.buscarCarrito, { rows: [] }], // usuario nuevo, hay que crearle carrito
    [Q.crearCarrito, () => { throw new Error('no se pudo crear el carrito'); }],
  ]);
  t.after(restore);

  const res = await sincronizarCarrito([{ product_id: 'khamrah', quantity: 1 }]);

  assert.equal(res.status, 500);
  assert.equal(ran(log, Q.begin), true);
  assert.equal(ran(log, Q.rollback), true);
  assert.equal(ran(log, Q.commit), false);
});

test('COR-2 checkout: si falla el registro del pago, se revierten la orden y el stock', async (t) => {
  const { log, restore } = fakeDb([
    ...BASE,
    [Q.itemsConProducto, {
      rows: [{ product_id: 'khamrah', quantity: 1, name: 'Khamrah', price: '390.00', stock: 10 }],
    }],
    [Q.descontarStock, { rows: [{ id: 'ok' }] }],
    [Q.crearOrden, { rows: [{ id: 902, created_at: '2026-01-01T00:00:00.000Z' }] }],
    [Q.registrarPago, () => { throw new Error('se cayó la base al registrar el pago'); }],
  ]);
  t.after(restore);

  const res = await checkout();
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.equal(body.code, 'PAYMENT_ERROR');

  assert.equal(ran(log, Q.rollback), true);
  assert.equal(ran(log, Q.commit), false, 'no debe quedar una orden sin su pago registrado');
});

test('carrito: sincronizar items válidos reemplaza el contenido y confirma', async (t) => {
  const { log, restore } = fakeDb([
    [Q.buscarCarrito, { rows: [{ id: CART_ID }] }],
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
    body: JSON.stringify(TARJETA_VALIDA),
  });
  assert.equal(checkoutSinToken.status, 401);
});

test('un cliente no puede hacer checkout del carrito de otro usuario (IDOR)', async (t) => {
  const { log, restore } = fakeDb(BASE);
  t.after(restore);

  const res = await pedir('POST', '/checkout/999', TARJETA_VALIDA); // el token es del 7
  const body = await res.json();

  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.equal(log.length, 0, 'no debe tocarse la base si el acceso está denegado');
});
