// SFTWRKEY-432: cupones de descuento. Un cupón vencido, agotado o inventado no descuenta nada, el
// descuento o total que mande el navegador se ignora, el límite se respeta con compras simultáneas
// y validar cupones tiene rate limit.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'test-secret';

const { default: pool } = await import('./db.js');
const { signToken } = await import('./services/auth.js');
const { default: app } = await import('./server.js');
const { gateway } = await import('./services/paymentGateway.js');
const { discountCents, normalizeCode, couponState } = await import('./services/coupons.js');
const { cancelSession } = await import('./services/checkoutSessions.js');
const { validateCouponInput, VALIDATE_LIMIT } = await import('./routes/coupons.js');
const { buildOrderEmail } = await import('./services/mailer.js');

// Recurrente simulado: guarda lo que se le pidió
const checkoutsPedidos = [];
gateway.createCheckout = async (request) => {
  checkoutsPedidos.push(request);
  return { id: `ch_${checkoutsPedidos.length}`, url: 'https://recurrente.test/checkout', status: 'unpaid' };
};
gateway.getCheckout = async (id) => ({ id, status: 'paid', paymentId: 'pa_1', brand: 'VISA', last4: '4242', failureReason: null });

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';
const FUTURO = '2099-12-31T23:59:59Z';
const PASADO = '2020-01-01T00:00:00Z';

const cupon = (id, code, extra = {}) => ({
  id, code, discount_type: 'porcentaje', value: '10.00', min_purchase: '0.00', max_uses: null,
  expires_at: FUTURO, active: true, ...extra,
});

const CUPONES = [
  cupon(1, 'VERANO10'),
  cupon(2, 'FIJO50', { discount_type: 'monto', value: '50.00' }),
  cupon(3, 'VENCIDO', { expires_at: PASADO }),
  cupon(4, 'AGOTADO', { max_uses: 1 }),
  cupon(5, 'APAGADO', { active: false }),
  cupon(6, 'MINIMO', { min_purchase: '1000.00' }),
  cupon(7, 'UNO', { max_uses: 1 }),
];
// AGOTADO ya se usó su única vez
const USOS = [{ coupon_id: 4, session_id: 'x', user_id: 99, guest_email: null, status: 'usado' }];

// Khamrah a Q260 en la base; el carrito del cliente trae 2 (Q520)
const PRODUCTOS = [{ id: 'khamrah', name: 'Lattafa Khamrah', price: '260.00', stock: 10 }];
const CARRITO = [{ product_id: 'khamrah', quantity: 2 }];

const ok = { rows: [], rowCount: 0 };

// Doble de PostgreSQL con estado. Simula lo que importa para el límite de usos:
// - SELECT ... FOR UPDATE del cupón bloquea hasta el COMMIT/ROLLBACK de esa transacción
// - los usos insertados solo los ve el resto después del COMMIT (READ COMMITTED)
function tienda({ coupons = CUPONES, uses = USOS, products = PRODUCTOS, cart = CARRITO, session = null } = {}) {
  const log = [];
  const state = { uses: uses.map((u) => ({ ...u })), sessions: [] };
  const original = { query: pool.query, connect: pool.connect };
  let owner = null;
  let waiting = [];
  let nextClient = 1;

  const lock = async (id) => {
    while (owner !== null && owner !== id) await new Promise((resolve) => waiting.push(resolve));
    owner = id;
  };
  const unlock = (id) => {
    if (owner !== id) return;
    owner = null;
    const wake = waiting;
    waiting = [];
    wake.forEach((resolve) => resolve());
  };

  const makeRun = (clientId) => {
    const pending = [];
    return async (sql, params = []) => {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      log.push({ sql: text, params, clientId });

      if (text === 'BEGIN') return ok;
      if (text === 'COMMIT') { state.uses.push(...pending.splice(0)); unlock(clientId); return ok; }
      if (text === 'ROLLBACK') { pending.splice(0); unlock(clientId); return ok; }

      if (/FROM coupons WHERE code = \$1/.test(text)) {
        if (/FOR UPDATE/.test(text)) await lock(clientId);
        return { rows: coupons.filter((c) => c.code === params[0]) };
      }
      if (/FROM coupon_uses WHERE coupon_id = \$1/.test(text)) {
        const visibles = [...state.uses, ...pending].filter(
          (u) => u.coupon_id === params[0] && (u.status === 'reservado' || u.status === 'usado')
        );
        const mine = visibles.filter(
          (u) => (params[1] != null && u.user_id === params[1]) || (params[2] != null && u.guest_email === params[2])
        );
        const rows = [{ total: visibles.length, mine: mine.length }];
        // pausa entre contar y apartar: sin el FOR UPDATE, dos compras simultáneas contarían
        // las dos antes de que cualquiera haga COMMIT (lo que pasa de verdad con mucha carga)
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { rows };
      }
      if (/^INSERT INTO coupon_uses/.test(text)) {
        pending.push({ coupon_id: params[0], session_id: params[1], user_id: params[2], guest_email: params[3], discount: params[4], status: 'reservado' });
        return { rows: [], rowCount: 1 };
      }
      if (/^UPDATE coupon_uses SET status/.test(text)) return { rows: [], rowCount: 1 };

      if (/SELECT id, price FROM products/.test(text) || /SELECT id, name, price, stock FROM products/.test(text)) {
        return { rows: products.filter((p) => params[0].includes(p.id)) };
      }
      if (/FROM cart_items ci JOIN carts c/.test(text)) return { rows: cart };
      if (/^INSERT INTO checkout_sessions/.test(text)) { state.sessions.push(params); return { rows: [], rowCount: 1 }; }
      if (/FROM checkout_sessions WHERE id = \$1/.test(text)) return { rows: session ? [session] : [] };
      if (/^INSERT INTO orders/.test(text)) return { rows: [{ id: 99, total: params[1], created_at: '2026-10-28T10:00:00Z' }] };
      if (/FROM orders WHERE id = \$1/.test(text)) {
        return { rows: [{ id: 99, total: '468.00', created_at: '2026-10-28T10:00:00Z', shipping_cost: '0.00', delivery_method: 'recoger', delivery_address: null, discount: '52.00', coupon_code: 'VERANO10' }] };
      }
      if (/FROM payments/.test(text)) return { rows: [{ card_brand: 'VISA', card_last4: '4242' }] };
      return ok;
    };
  };

  pool.query = makeRun('pool');
  pool.connect = async () => ({ query: makeRun(nextClient++), release() {} });
  return { log, state, restore: () => { pool.query = original.query; pool.connect = original.connect; } };
}

const sqls = (log, re) => log.filter((e) => re.test(e.sql));

// cada prueba usa su propia IP para que los rate limit no se mezclen
let ipSeq = 10;
const nuevaIp = () => `198.51.100.${ipSeq++}`;

const validar = (body, { ip = nuevaIp(), token } = {}) =>
  fetch(`${baseUrl}/coupons/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const RECOGER = { deliveryMethod: 'recoger', pickupStore: 'victoria' };
const ENVIO = { deliveryMethod: 'envio', billingAddress: '5a avenida 1-23', city: 'Guatemala', postalCode: '01001', country: 'Guatemala' };

const comprar = (userId, body) =>
  fetch(`${baseUrl}/checkout/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nuevaIp(), Authorization: `Bearer ${signToken({ id: userId, role: 'CLIENTE' })}` },
    body: JSON.stringify(body),
  });

const comprarInvitado = (body) =>
  fetch(`${baseUrl}/guest-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'Idempotency-Key': randomUUID(), 'X-Forwarded-For': nuevaIp() },
    body: JSON.stringify({
      guest: { name: 'Invitado Prueba', email: 'Invitado@Test.com' },
      items: [{ product_id: 'khamrah', quantity: 2 }],
      address: RECOGER,
      expectedCents: 52000,
      ...body,
    }),
  });

// ── Reglas ───────────────────────────────────────────────────────────────────

test('el descuento: porcentaje o monto fijo, y nunca deja los productos por debajo de Q5', () => {
  assert.equal(discountCents({ discount_type: 'porcentaje', value: '10' }, 52000), 5200);
  assert.equal(discountCents({ discount_type: 'porcentaje', value: '12.5' }, 999), 125);
  assert.equal(discountCents({ discount_type: 'monto', value: '50.00' }, 52000), 5000);
  assert.equal(discountCents({ discount_type: 'monto', value: '600' }, 52000), 51500, 'quedan Q5 por pagar');
  assert.equal(discountCents({ discount_type: 'porcentaje', value: '100' }, 52000), 51500);
  assert.equal(discountCents({ discount_type: 'monto', value: '10' }, 500), 0);
});

test('el código se normaliza a mayúsculas y solo acepta letras, números, guiones y guiones bajos', () => {
  assert.equal(normalizeCode('  verano10 '), 'VERANO10');
  assert.equal(normalizeCode('black-friday_2026'), 'BLACK-FRIDAY_2026');
  for (const malo of ['ab', 'x'.repeat(31), "' OR 1=1 --", 'con espacio', null, 10]) {
    assert.equal(normalizeCode(malo), null, String(malo));
  }
});

// ── Validar (vista previa en el carrito) ─────────────────────────────────────

test('validar: un cupón válido calcula el descuento con el precio de la base, no con el del navegador', async (t) => {
  const { restore } = tienda();
  t.after(restore);

  const res = await validar({ code: 'verano10', items: [{ product_id: 'khamrah', quantity: 2, price: 1 }], discount: 999 });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body.coupon, { code: 'VERANO10', discount_type: 'porcentaje', value: 10, min_purchase: 0 });
  assert.equal(body.subtotal, 520);
  assert.equal(body.discount, 52);
});

test('validar: un cupón inventado, desactivado, vencido o agotado no descuenta nada', async (t) => {
  const { restore } = tienda();
  t.after(restore);

  const casos = [
    ['NOEXISTE', 'COUPON_NOT_FOUND'],
    ['APAGADO', 'COUPON_NOT_FOUND'],
    ['VENCIDO', 'COUPON_EXPIRED'],
    ['AGOTADO', 'COUPON_EXHAUSTED'],
    ['MINIMO', 'COUPON_MIN_PURCHASE'],
  ];
  for (const [code, esperado] of casos) {
    const res = await validar({ code, items: CARRITO });
    const body = await res.json();
    assert.equal(res.status, 400, code);
    assert.equal(body.code, esperado, code);
    assert.equal(body.discount, undefined, `${code} no trae descuento`);
  }
});

test('validar: un código con formato inválido responde 400 sin consultar la base', async (t) => {
  const { log, restore } = tienda();
  t.after(restore);

  const res = await validar({ code: "' OR 1=1 --", items: CARRITO });
  assert.equal(res.status, 400);
  assert.equal(log.length, 0);
});

test('validar: con sesión avisa si el cliente ya usó el cupón', async (t) => {
  const { restore } = tienda({ uses: [{ coupon_id: 1, session_id: 'y', user_id: 7, guest_email: null, status: 'usado' }] });
  t.after(restore);

  const res = await validar({ code: 'VERANO10', items: CARRITO }, { token: signToken({ id: 7, role: 'CLIENTE' }) });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'COUPON_ALREADY_USED');

  // otro cliente sí puede
  const otro = await validar({ code: 'VERANO10', items: CARRITO }, { token: signToken({ id: 8, role: 'CLIENTE' }) });
  assert.equal(otro.status, 200);
});

test(`validar tiene rate limit: el intento ${VALIDATE_LIMIT.max + 1} en un minuto desde la misma IP responde 429`, async (t) => {
  const { log, restore } = tienda();
  t.after(restore);

  const ip = nuevaIp();
  for (let i = 0; i < VALIDATE_LIMIT.max; i++) {
    const res = await validar({ code: `PRUEBA${i}`, items: CARRITO }, { ip });
    assert.equal(res.status, 400, `intento ${i + 1}`);
  }
  const bloqueado = await validar({ code: 'VERANO10', items: CARRITO }, { ip });
  assert.equal(bloqueado.status, 429);
  assert.equal(sqls(log, /INSERT INTO security_events/i).length, 1, 'queda la alerta para el admin');

  // otra IP sigue pudiendo
  assert.equal((await validar({ code: 'VERANO10', items: CARRITO })).status, 200);
});

// ── Comprar con cupón ────────────────────────────────────────────────────────

test('compra con cupón: el total sale del servidor y el descuento o total que mande el navegador se ignora', async (t) => {
  const { log, state, restore } = tienda();
  t.after(restore);
  const antes = checkoutsPedidos.length;

  const res = await comprar(7, { ...RECOGER, couponCode: 'verano10', discount: 519, discountCents: 51900, total: 1, amount: 1 });
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.total, 468, 'Q520 - 10%');
  const [sesion] = state.sessions;
  assert.equal(sesion[4], 468, 'total de la sesión');
  assert.equal(sesion[8], 52, 'descuento guardado');
  assert.equal(sesion[9], 'VERANO10');
  // el uso queda apartado con el cupón bloqueado, en la misma transacción
  assert.deepEqual(state.uses.at(-1), { coupon_id: 1, session_id: sesion[0], user_id: 7, guest_email: null, discount: 52, status: 'reservado' });
  assert.equal(sqls(log, /FROM coupons WHERE code = \$1 FOR UPDATE/).length, 1);
  // a Recurrente va un solo renglón por el total exacto
  assert.deepEqual(checkoutsPedidos[antes].items, [{ name: 'Compra Perfumería Victoria · cupón VERANO10', quantity: 1, price: 468 }]);
});

test('sin cupón, un descuento o total enviado desde el navegador se ignora: se cobra el precio de la base', async (t) => {
  const { state, restore } = tienda();
  t.after(restore);
  const antes = checkoutsPedidos.length;

  const res = await comprar(7, { ...RECOGER, discount: 500, total: 1, price: 1 });
  assert.equal(res.status, 201);
  assert.equal(state.sessions[0][4], 520);
  assert.equal(state.sessions[0][8], 0);
  assert.equal(state.sessions[0][9], null);
  assert.deepEqual(checkoutsPedidos[antes].items, [{ product_id: 'khamrah', name: 'Lattafa Khamrah', quantity: 2, price: 260 }]);
});

test('compra con cupón vencido, agotado, desactivado o inventado: no descuenta nada ni abre el pago', async (t) => {
  for (const code of ['VENCIDO', 'AGOTADO', 'APAGADO', 'NOEXISTE']) {
    const { log, state, restore } = tienda();
    const antes = checkoutsPedidos.length;
    try {
      const res = await comprar(7, { ...RECOGER, couponCode: code });
      const body = await res.json();
      assert.equal(res.status, 400, code);
      assert.match(body.code, /^COUPON_/, code);
      assert.equal(state.sessions.length, 0, `${code}: no se crea la sesión`);
      assert.equal(state.uses.length, USOS.length, `${code}: no se aparta ningún uso`);
      assert.equal(checkoutsPedidos.length, antes, `${code}: no se llama a Recurrente`);
      assert.equal(sqls(log, /^ROLLBACK$/).length, 1, `${code}: el stock apartado se devuelve`);
    } finally {
      restore();
    }
  }
});

test('el envío se calcula con los productos ya rebajados: Q520 - Q50 = Q470 paga envío', async (t) => {
  const { state, restore } = tienda();
  t.after(restore);

  const res = await comprar(7, { ...ENVIO, couponCode: 'FIJO50' });
  assert.equal(res.status, 201);
  assert.equal(state.sessions[0][4], 505, 'Q470 + Q35 de envío');
  assert.equal(state.sessions[0][6], 35);
});

test('un cliente no puede usar dos veces el mismo cupón', async (t) => {
  const { state, restore } = tienda({ uses: [{ coupon_id: 1, session_id: 'z', user_id: 7, guest_email: null, status: 'usado' }] });
  t.after(restore);

  const res = await comprar(7, { ...RECOGER, couponCode: 'VERANO10' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, 'COUPON_ALREADY_USED');
  assert.equal(state.sessions.length, 0);
});

test('compras simultáneas: con un cupón de 1 uso, solo una de dos compras al mismo tiempo lo obtiene', async (t) => {
  const { state, restore } = tienda();
  t.after(restore);

  const [a, b] = await Promise.all([
    comprar(7, { ...RECOGER, couponCode: 'UNO' }),
    comprar(8, { ...RECOGER, couponCode: 'UNO' }),
  ]);
  const estados = [a.status, b.status].sort();
  assert.deepEqual(estados, [201, 400]);
  const rechazada = a.status === 400 ? a : b;
  assert.equal((await rechazada.json()).code, 'COUPON_EXHAUSTED');
  assert.equal(state.uses.filter((u) => u.coupon_id === 7).length, 1, 'el límite se respeta');
  assert.equal(state.sessions.length, 1);
});

test('invitado: el cupón descuenta y el uso queda con su correo; el mismo correo no lo puede volver a usar', async (t) => {
  const { state, restore } = tienda();
  t.after(restore);

  const res = await comprarInvitado({ couponCode: 'verano10', discount: 999 });
  assert.equal(res.status, 201);
  assert.equal(state.sessions[0][4], 468);
  assert.equal(state.uses.at(-1).guest_email, 'invitado@test.com');

  const otraVez = await comprarInvitado({ couponCode: 'VERANO10' });
  assert.equal(otraVez.status, 400);
  assert.equal((await otraVez.json()).code, 'COUPON_ALREADY_USED');
});

// ── Ciclo del uso ────────────────────────────────────────────────────────────

test('si el pago se cancela, el uso apartado se libera y vuelve a estar disponible', async (t) => {
  const ref = randomUUID();
  const { log, restore } = tienda({
    session: { id: ref, status: 'pendiente', gateway_checkout_id: null, items: [], user_id: 7, total: '468.00', coupon_code: 'VERANO10' },
  });
  t.after(restore);

  assert.deepEqual(await cancelSession(ref), { status: 'cancelado', failureReason: null });
  const liberar = sqls(log, /^UPDATE coupon_uses SET status = 'liberado'/);
  assert.equal(liberar.length, 1);
  assert.deepEqual(liberar[0].params, [ref]);
});

test('cuando Recurrente confirma el cobro, el pedido guarda el descuento y el uso queda como usado', async (t) => {
  const ref = randomUUID();
  const { log, restore } = tienda({
    session: {
      id: ref, status: 'pendiente', gateway_checkout_id: 'ch_1', user_id: 7, total: '468.00', shipping_cost: '0.00',
      discount: '52.00', coupon_code: 'VERANO10', delivery: { method: 'recoger', store: { id: 'victoria' } },
      items: [{ product_id: 'khamrah', name: 'Lattafa Khamrah', quantity: 2, price: 260 }],
    },
  });
  t.after(restore);

  const res = await fetch(`${baseUrl}/checkout/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nuevaIp() },
    body: JSON.stringify({ reference: ref }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  const pedido = sqls(log, /^INSERT INTO orders/)[0].params;
  assert.equal(pedido[5], '52.00', 'descuento en el pedido');
  assert.equal(pedido[6], 'VERANO10');
  assert.deepEqual(sqls(log, /^UPDATE coupon_uses SET status = 'usado'/)[0].params, [ref, 99]);
  assert.equal(body.order.discount, 52);
  assert.equal(body.order.coupon, 'VERANO10');
});

test('el correo de confirmación muestra el descuento para que los renglones sumen el total', () => {
  const { text, html } = buildOrderEmail({
    status: 'pagado', orderId: 99, customerName: 'Ana', total: 468, shipping: 0,
    delivery: { method: 'recoger', store: { name: 'Joyería Victoria', address: 'Zona 1' } },
    items: [{ name: 'Lattafa Khamrah', quantity: 2, unit_price: '260.00' }],
    discount: 52, couponCode: 'VERANO10',
  });
  assert.match(text, /Descuento \(VERANO10\): -Q52\.00/);
  assert.match(html, /Descuento \(VERANO10\)/);
});

// ── Admin ────────────────────────────────────────────────────────────────────

const ADMIN = signToken({ id: 1, role: 'ADMIN' });
const crear = (body, token = ADMIN) =>
  fetch(`${baseUrl}/admin/coupons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
const NUEVO = { code: 'navidad25', discount_type: 'porcentaje', value: 25, min_purchase: 300, max_uses: 50, expires_at: '2099-12-31' };

test('admin: crea un cupón; el código va en mayúsculas y vence al final de ese día en Guatemala', async (t) => {
  let params;
  const { restore } = tienda();
  pool.query = async (sql, p) => {
    params = p;
    return { rows: [{ id: 10, code: p[0], discount_type: p[1], value: p[2], min_purchase: p[3], max_uses: p[4], expires_at: p[5], active: true, created_at: '2026-10-28' }] };
  };
  t.after(restore);

  const res = await crear(NUEVO);
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.deepEqual(params.slice(0, 5), ['NAVIDAD25', 'porcentaje', 25, 300, 50]);
  assert.equal(params[5].toISOString(), '2100-01-01T05:59:59.999Z', '31/12/2099 23:59:59 hora de Guatemala');
  assert.equal(params[6], 1, 'queda quién lo creó');
  assert.equal(body.coupon.state, 'activo');
});

test('admin: datos inválidos dan 400 y un código repetido 409', async (t) => {
  const { restore } = tienda();
  t.after(restore);

  for (const malo of [
    { ...NUEVO, code: 'a' },
    { ...NUEVO, discount_type: 'regalo' },
    { ...NUEVO, value: 0 },
    { ...NUEVO, value: 101 },
    { ...NUEVO, value: 'diez' },
    { ...NUEVO, max_uses: 0 },
    { ...NUEVO, max_uses: 2.5 },
    { ...NUEVO, min_purchase: -1 },
    { ...NUEVO, expires_at: '2020-01-01' },
    { ...NUEVO, expires_at: '2099-02-30' },
  ]) {
    assert.equal((await crear(malo)).status, 400, JSON.stringify(malo));
  }

  pool.query = async () => { throw Object.assign(new Error('duplicate key'), { code: '23505' }); };
  assert.equal((await crear(NUEVO)).status, 409);
});

test('admin: sin límite de usos y sin compra mínima también se puede', () => {
  const input = validateCouponInput({ code: 'libre', discount_type: 'monto', value: '75.5', expires_at: '2099-01-01' });
  assert.equal(input.maxUses, null);
  assert.equal(input.minPurchase, 0);
  assert.equal(input.value, 75.5);
});

test('admin: un cliente no puede crear, ver ni desactivar cupones', async (t) => {
  const { log, restore } = tienda();
  t.after(restore);
  const cliente = signToken({ id: 7, role: 'CLIENTE' });

  assert.equal((await crear(NUEVO, cliente)).status, 403);
  assert.equal((await fetch(`${baseUrl}/admin/coupons`, { headers: { Authorization: `Bearer ${cliente}` } })).status, 403);
  assert.equal(
    (await fetch(`${baseUrl}/admin/coupons/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cliente}` },
      body: JSON.stringify({ active: false }),
    })).status,
    403
  );
  assert.equal(log.length, 0);
});

test('admin: desactiva un cupón y la lista muestra su estado', async (t) => {
  const { restore } = tienda();
  pool.query = async (sql, p) => {
    if (/^UPDATE coupons SET active/.test(String(sql))) return { rows: [{ id: p[1] }], rowCount: 1 };
    return { rows: [{ ...CUPONES[0], active: false, used: 3, reserved: 0, total_discount: '150.00' }] };
  };
  t.after(restore);

  const res = await fetch(`${baseUrl}/admin/coupons/1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN}` },
    body: JSON.stringify({ active: false }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.coupon.state, 'desactivado');
  assert.equal(body.coupon.used, 3);
  assert.equal(body.coupon.total_discount, 150);
});

test('estado del cupón para el panel', () => {
  assert.equal(couponState({ ...CUPONES[0], used: 0 }), 'activo');
  assert.equal(couponState({ ...CUPONES[0], active: false, used: 0 }), 'desactivado');
  assert.equal(couponState({ ...CUPONES[2], used: 0 }), 'vencido');
  assert.equal(couponState({ ...CUPONES[3], used: 1, reserved: 0 }), 'agotado');
  assert.equal(couponState({ ...CUPONES[6], used: 0, reserved: 1 }), 'agotado', 'un pago abierto también ocupa el uso');
});
