// SFTWRKEY-445: compra con la página de pago de Recurrente.
//
// 1. startCheckout: el backend recalcula el total con los precios de la base, aparta el stock y
//    guarda una sesión de pago "pendiente". Todavía NO hay pedido.
// 2. El cliente paga en Recurrente y vuelve a /pago/resultado (o a /pago/cancelado si se sale).
// 3. confirmSession le pregunta a Recurrente si el checkout quedó pagado. Solo entonces se crea el
//    pedido 'pagado', se registra el pago y se manda el correo. Así un pago rechazado nunca crea
//    un pedido, y ni los reportes ni el panel ven compras que no se cobraron.
// 4. Si el cliente se va sin pagar, la sesión se cancela y el stock regresa (al volver por
//    /pago/cancelado o, si cierra la pestaña, con el barrido de sesiones vencidas).
import crypto from 'node:crypto';
import pool from '../db.js';
import { gateway } from './paymentGateway.js';
import { notifyOrderStatus } from './orderEmails.js';
import { shippingCents, deliveryView } from './shipping.js';

// el checkout de Recurrente y el stock apartado vencen a los 30 minutos
export const SESSION_MINUTES = 30;
// margen para no cancelar una sesión justo cuando el cliente está terminando de pagar
const SWEEP_GRACE_MINUTES = 2;

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let tablesReady;
export const ensureCheckoutTables = () => {
  if (!tablesReady) {
    tablesReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
          user_id INTEGER REFERENCES users(id),
          amount NUMERIC(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'GTQ',
          status VARCHAR(20) NOT NULL,
          gateway_reference VARCHAR(100),
          auth_code VARCHAR(20),
          card_brand VARCHAR(20),
          card_last4 VARCHAR(4),
          decline_code VARCHAR(50),
          decline_message TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        -- las compras de invitado también quedan en payments, sin usuario
        ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;

        CREATE TABLE IF NOT EXISTS checkout_sessions (
          id UUID PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          guest JSONB,
          items JSONB NOT NULL,
          total NUMERIC(10, 2) NOT NULL,
          gateway_checkout_id VARCHAR(100),
          checkout_url TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
          order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        -- SFTWRKEY-449: forma de entrega y envío elegidos al abrir el pago
        ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS delivery JSONB;
        ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS checkout_sessions_pendientes ON checkout_sessions (status, expires_at);
        CREATE INDEX IF NOT EXISTS checkout_sessions_checkout ON checkout_sessions (gateway_checkout_id);

        -- SFTWRKEY-446: cada aviso (webhook) que llega de Recurrente, para revisarlo si algo falla.
        -- provider_event_id es el svix-id: un aviso repetido no se procesa dos veces.
        CREATE TABLE IF NOT EXISTS payment_webhook_events (
          id SERIAL PRIMARY KEY,
          provider_event_id VARCHAR(100) UNIQUE,
          event_type VARCHAR(60),
          checkout_id VARCHAR(100),
          status VARCHAR(20) NOT NULL,
          order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
          detail TEXT,
          payload JSONB,
          ip VARCHAR(45),
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ
        );
      `)
      .then(() =>
        // SFTWRKEY-446: un mismo pago de Recurrente nunca se registra dos veces como aprobado.
        // Va aparte: si no se pudiera crear (pagos repetidos de antes), el checkout sigue
        // funcionando, porque el FOR UPDATE de la sesión ya impide crear dos pedidos.
        pool
          .query(
            `CREATE UNIQUE INDEX IF NOT EXISTS payments_aprobado_referencia_unica
               ON payments (gateway_reference)
               WHERE status = 'aprobado' AND gateway_reference IS NOT NULL`
          )
          .catch((err) => console.error('No se pudo crear el índice único de pagos:', err.message))
      )
      .catch((err) => {
        tablesReady = undefined;
        throw err;
      });
  }
  return tablesReady;
};

export const checkoutError = (status, code, message, extra = {}) =>
  Object.assign(new Error(message), { status, code, ...extra });

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Aparta el stock dentro de la transacción del llamador. El total sale siempre de products.price.
// items: [{ product_id, quantity }]
export async function reserveStock(db, items) {
  const products = await db.query(
    `SELECT id, name, price, stock FROM products
     WHERE id = ANY($1::varchar[])
     ORDER BY id
     FOR UPDATE`,
    [items.map((item) => item.product_id)]
  );

  const lines = [];
  const missing = [];
  let cents = 0;
  for (const item of items) {
    const product = products.rows.find((p) => p.id === item.product_id);
    if (!product || product.stock < item.quantity) {
      missing.push({
        product_id: item.product_id,
        name: product?.name ?? item.product_id,
        disponible: product?.stock ?? 0,
        solicitado: item.quantity,
      });
      continue;
    }
    const priceCents = Math.round(Number(product.price) * 100);
    cents += priceCents * item.quantity;
    lines.push({ product_id: product.id, name: product.name, quantity: item.quantity, price: priceCents / 100 });
  }

  if (missing.length) {
    throw checkoutError(409, 'INSUFFICIENT_STOCK', 'Algunos productos ya no tienen stock suficiente.', { items: missing });
  }
  // Recurrente no cobra menos de Q5
  if (cents < 500) throw checkoutError(400, 'AMOUNT_TOO_LOW', 'El total mínimo para pagar en línea es Q5.00.');
  if (cents > 99999999) throw checkoutError(400, 'AMOUNT_TOO_HIGH', 'El total supera el límite por pedido.');

  for (const line of lines) {
    await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [line.quantity, line.product_id]);
  }
  return { lines, cents };
}

// Crea la sesión pendiente dentro de la transacción del llamador (después de reserveStock).
// SFTWRKEY-449: el envío se calcula aquí con el subtotal de la base y la forma de entrega
// (services/shipping.js); el total que se cobra ya lo incluye.
export async function createSession(db, { userId = null, guest = null, lines, cents, delivery }) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60_000);
  const shipping = shippingCents(cents, delivery.method);
  const total = cents + shipping;
  await db.query(
    `INSERT INTO checkout_sessions (id, user_id, guest, items, total, delivery, shipping_cost, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, userId, guest, JSON.stringify(lines), total / 100, delivery, shipping / 100, expiresAt]
  );
  return { id, lines, cents: total, subtotalCents: cents, shippingCents: shipping, expiresAt };
}

const frontendBase = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

// Después del COMMIT: crea el checkout en Recurrente. Si falla, la sesión se cancela y el stock regresa.
export async function openCheckout(session) {
  try {
    const checkout = await gateway.createCheckout({
      reference: session.id,
      // el envío va como un renglón más para que el total en Recurrente sea el mismo que en la tienda
      items: session.shippingCents
        ? [...session.lines, { name: 'Envío a domicilio', quantity: 1, price: session.shippingCents / 100 }]
        : session.lines,
      successUrl: `${frontendBase()}/pago/resultado?ref=${session.id}`,
      cancelUrl: `${frontendBase()}/pago/cancelado?ref=${session.id}`,
      expiresAt: session.expiresAt,
    });
    await pool.query(
      'UPDATE checkout_sessions SET gateway_checkout_id = $2, checkout_url = $3 WHERE id = $1',
      [session.id, checkout.id, checkout.url]
    );
    return checkout.url;
  } catch (err) {
    await closeUnpaid(session.id).catch((e) => console.error('No se pudo liberar el stock de la sesión:', e.message));
    throw err;
  }
}

const getSession = async (id) =>
  (await pool.query('SELECT * FROM checkout_sessions WHERE id = $1', [id])).rows[0] ?? null;

// Cancela una sesión que no se pagó: el stock regresa y el intento queda en payments sin pedido
async function closeUnpaid(sessionId, failureReason = null) {
  return withTransaction(async (db) => {
    const session = (await db.query('SELECT * FROM checkout_sessions WHERE id = $1 FOR UPDATE', [sessionId])).rows[0];
    if (!session || session.status !== 'pendiente') return session?.status ?? null;

    for (const line of session.items) {
      await db.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [line.quantity, line.product_id]);
    }
    await db.query(`UPDATE checkout_sessions SET status = 'cancelado' WHERE id = $1`, [sessionId]);

    if (session.gateway_checkout_id) {
      await db.query(
        `INSERT INTO payments (order_id, user_id, amount, status, gateway_reference, decline_message)
         VALUES (NULL, $1, $2, $3, $4, $5)`,
        [session.user_id, session.total, failureReason ? 'rechazado' : 'cancelado', session.gateway_checkout_id, failureReason]
      );
    }
    return 'cancelado';
  });
}

// Crea el pedido de una sesión que Recurrente confirmó como pagada. Es idempotente: si el cliente
// recarga la página o llegan dos confirmaciones a la vez, se crea un solo pedido.
async function settlePaid(sessionId, checkout) {
  const result = await withTransaction(async (db) => {
    const session = (await db.query('SELECT * FROM checkout_sessions WHERE id = $1 FOR UPDATE', [sessionId])).rows[0];
    if (session.status === 'pagado') return { orderId: session.order_id, created: false };

    if (session.status === 'cancelado') {
      // pagó justo cuando la sesión ya se había vencido y el stock había regresado: se vuelve a
      // descontar. El cobro ya se hizo, así que el pedido se crea aunque el stock quede en 0.
      console.warn(`Sesión ${sessionId} pagada después de vencer: se vuelve a descontar el stock.`);
      for (const line of session.items) {
        await db.query('UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2', [line.quantity, line.product_id]);
      }
    }

    // SFTWRKEY-417: el pedido nace como 'pagado' y queda la primera fila del historial
    // SFTWRKEY-449: el pedido guarda cuánto fue el envío y a dónde se entrega (o en qué local se recoge)
    const delivery = session.delivery ?? null;
    const order = (
      await db.query(
        `INSERT INTO orders (user_id, total, status, shipping_cost, delivery_method, delivery_address)
         VALUES ($1, $2, 'pagado', $3, $4, $5)
         RETURNING id, total, created_at`,
        [session.user_id, session.total, session.shipping_cost ?? 0, delivery?.method ?? null, delivery?.address ?? delivery?.store ?? null]
      )
    ).rows[0];
    await db.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status) VALUES ($1, NULL, 'pagado')`,
      [order.id]
    );
    for (const line of session.items) {
      await db.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [order.id, line.product_id, line.quantity, line.price]
      );
    }

    // SFTWRKEY-299: el pago queda registrado junto con el pedido, solo marca y últimos 4 dígitos
    await db.query(
      `INSERT INTO payments (order_id, user_id, amount, status, gateway_reference, card_brand, card_last4)
       VALUES ($1, $2, $3, 'aprobado', $4, $5, $6)`,
      [order.id, session.user_id, session.total, checkout.paymentId ?? checkout.id, checkout.brand, checkout.last4]
    );

    if (session.user_id) {
      // se quitan del carrito los perfumes que se compraron
      await db.query(
        `DELETE FROM cart_items
         WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)
           AND product_id = ANY($2::varchar[])`,
        [session.user_id, session.items.map((line) => line.product_id)]
      );
    } else if (session.guest) {
      // los datos del invitado quedan donde ya los leen el panel, los correos y el chatbot
      const { name, email, address, keyHash, requestHash } = session.guest;
      await db.query(
        `INSERT INTO guest_receipts (key_hash, request_hash, order_id, guest_name, guest_email, address, response)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          keyHash,
          requestHash,
          order.id,
          name,
          email,
          address,
          {
            success: true,
            order: { id: order.id, total: Number(order.total), created_at: order.created_at },
            payment: { brand: checkout.brand, last4: checkout.last4 },
          },
        ]
      );
    }

    await db.query(`UPDATE checkout_sessions SET status = 'pagado', order_id = $2 WHERE id = $1`, [sessionId, order.id]);
    return { orderId: order.id, created: true };
  });

  // SFTWRKEY-447: correo de confirmación; no frena la respuesta si falla
  if (result.created) void notifyOrderStatus(pool, result.orderId, 'pagado');
  return result.orderId;
}

// Lo que ve el cliente al volver de Recurrente: número de pedido, productos, total y tarjeta
async function paidView(session, orderId) {
  const order = (
    await pool.query(
      'SELECT id, total, created_at, shipping_cost, delivery_method, delivery_address FROM orders WHERE id = $1',
      [orderId]
    )
  ).rows[0];
  const payment = (
    await pool.query(
      `SELECT card_brand, card_last4 FROM payments
       WHERE order_id = $1 AND status = 'aprobado'
       ORDER BY id DESC LIMIT 1`,
      [orderId]
    )
  ).rows[0];
  return {
    status: 'pagado',
    guest: !session.user_id,
    order: {
      id: order.id,
      total: Number(order.total),
      created_at: order.created_at,
      items: session.items.map(({ name, quantity, price }) => ({ name, quantity, price })),
      shipping: Number(order.shipping_cost),
      delivery: deliveryView(order),
    },
    payment: payment ? { brand: payment.card_brand, last4: payment.card_last4 } : null,
  };
}

// Al volver de Recurrente (/pago/resultado). null si la referencia no existe.
export async function confirmSession(sessionId) {
  await ensureCheckoutTables();
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.status === 'pagado') return paidView(session, session.order_id);
  if (!session.gateway_checkout_id) return { status: session.status };

  const checkout = await gateway.getCheckout(session.gateway_checkout_id);
  if (checkout.status === 'paid') {
    return paidView(session, await settlePaid(sessionId, checkout));
  }
  if (checkout.status === 'expired' && session.status === 'pendiente') {
    await closeUnpaid(sessionId, checkout.failureReason);
    return { status: 'cancelado', failureReason: checkout.failureReason };
  }
  return { status: session.status, failureReason: checkout.failureReason };
}

// Cuando el cliente se sale de la página de Recurrente sin pagar (/pago/cancelado).
// Antes de cancelar se le pregunta a Recurrente: si sí pagó, se crea el pedido.
export async function cancelSession(sessionId) {
  await ensureCheckoutTables();
  const session = await getSession(sessionId);
  if (!session) return null;
  if (session.status === 'pagado') return paidView(session, session.order_id);
  if (session.status !== 'pendiente') return { status: session.status };

  let failureReason = null;
  if (session.gateway_checkout_id) {
    const checkout = await gateway.getCheckout(session.gateway_checkout_id);
    if (checkout.status === 'paid') return paidView(session, await settlePaid(sessionId, checkout));
    if (checkout.status === 'payment_in_progress') return { status: 'pendiente' };
    failureReason = checkout.failureReason;
  }
  await closeUnpaid(sessionId, failureReason);
  return { status: 'cancelado', failureReason };
}

// Antes de abrir otro pago, se cierran los que el usuario dejó a medias (así no aparta stock dos veces)
export async function cancelPendingForUser(userId) {
  await ensureCheckoutTables();
  const pending = await pool.query(
    `SELECT id FROM checkout_sessions WHERE user_id = $1 AND status = 'pendiente'`,
    [userId]
  );
  for (const { id } of pending.rows) {
    await cancelSession(id).catch((err) => console.error(`No se pudo cerrar la sesión ${id}:`, err.message));
  }
}

// Sesiones vencidas de clientes que cerraron la pestaña: si se pagaron se crea el pedido, si no el
// stock regresa. Lo corre server.js cada pocos minutos.
export async function sweepExpiredSessions() {
  await ensureCheckoutTables();
  const expired = await pool.query(
    `SELECT id FROM checkout_sessions
     WHERE status = 'pendiente' AND expires_at < NOW() - ($1 || ' minutes')::interval
     ORDER BY expires_at
     LIMIT 20`,
    [String(SWEEP_GRACE_MINUTES)]
  );
  for (const { id } of expired.rows) {
    await cancelSession(id).catch((err) => console.error(`No se pudo revisar la sesión vencida ${id}:`, err.message));
  }
  return expired.rows.length;
}

// SFTWRKEY-446: el webhook de Recurrente trae el id del checkout; aquí se busca la sesión de la tienda
export async function findSessionIdByCheckout(checkoutId) {
  await ensureCheckoutTables();
  const result = await pool.query('SELECT id FROM checkout_sessions WHERE gateway_checkout_id = $1', [checkoutId]);
  return result.rows[0]?.id ?? null;
}
