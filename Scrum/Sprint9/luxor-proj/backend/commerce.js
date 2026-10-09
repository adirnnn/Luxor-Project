import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import pool from './db.js';
import {
  authenticate,
  requireRoles,
  signToken,
} from './services/auth.js';
import { rateLimit } from './services/rateLimit.js';
import {
  buildGatewayPayload,
  chargeCard,
} from './services/paymentGateway.js';

const router = Router();
const google = new OAuth2Client();

const hash = value =>
  createHash('sha256').update(value).digest('hex');

const fail = (status, message) =>
  Object.assign(new Error(message), { status });

const wrap = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.status || (err.code === '23505' ? 409 : 500);

    res.status(status).json({
      message: err.status
        ? err.message
        : status === 409
          ? 'La cuenta ya existe o ya está vinculada.'
          : 'No se pudo completar la operación.',
    });
  }
};

async function transaction(fn) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Conserva los productos, usuarios y pedidos existentes.
async function migrate() {
  await transaction(async db => {
    await db.query('SELECT pg_advisory_xact_lock(394400)');

    await db.query(`
      CREATE TABLE IF NOT EXISTS google_accounts (
        google_sub TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE
          REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS google_used_tokens (
        token_hash TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS guest_receipts (
        key_hash TEXT PRIMARY KEY,
        request_hash TEXT NOT NULL,
        order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
        guest_name VARCHAR(100) NOT NULL,
        guest_email VARCHAR(150) NOT NULL,
        address JSONB NOT NULL,
        response JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_order_events (
        id BIGSERIAL PRIMARY KEY,
        order_id INTEGER UNIQUE NOT NULL
          REFERENCES orders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admin_event_reads (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_id BIGINT
          REFERENCES admin_order_events(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, event_id)
      );

      CREATE OR REPLACE FUNCTION luxor_notify_order()
      RETURNS trigger AS $$
      BEGIN
        -- SFTWRKEY-417: los pedidos nuevos ahora nacen como 'pagado'
        IF NEW.status = 'pagado' THEN
          INSERT INTO admin_order_events(order_id)
          VALUES (NEW.id)
          ON CONFLICT (order_id) DO NOTHING;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS luxor_order_event ON orders;

      CREATE TRIGGER luxor_order_event
      AFTER INSERT OR UPDATE OF status ON orders
      FOR EACH ROW EXECUTE FUNCTION luxor_notify_order();
    `);
  });
}

let schema;

router.use(async (_req, res, next) => {
  try {
    if (!schema) {
      schema = migrate().catch(err => {
        schema = undefined;
        throw err;
      });
    }

    await schema;
    next();
  } catch {
    res.status(503).json({
      message: 'No se pudo preparar la base de datos.',
    });
  }
});

function sameOrigin(req, res, next) {
  const origin =
    process.env.FRONTEND_URL || 'http://localhost:5173';

  if (
    req.get('origin') !== origin ||
    !req.is('application/json')
  ) {
    return res.status(403).json({
      message: 'Origen o formato no permitido.',
    });
  }

  next();
}

const limited = rateLimit({
  windowMs: 60_000,
  max: 15,
});

function text(value, max, label, min = 1) {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  ) {
    throw fail(400, `Revisa ${label}.`);
  }

  return value.trim();
}

export function validateGuest(body) {
  const name = text(body?.guest?.name, 100, 'el nombre', 3);
  const email = text(
    body?.guest?.email,
    150,
    'el correo',
  ).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw fail(400, 'Correo inválido.');
  }

  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 30
  ) {
    throw fail(
      400,
      'El carrito debe contener entre 1 y 30 productos.',
    );
  }

  const seen = new Set();

  const items = body.items
    .map(item => {
      const id = text(item?.product_id, 100, 'el producto');

      if (
        seen.has(id) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      ) {
        throw fail(
          400,
          'Productos repetidos o cantidades inválidas: máximo 20 por producto.',
        );
      }

      seen.add(id);

      return {
        product_id: id,
        quantity: item.quantity,
      };
    })
    .sort((a, b) => a.product_id.localeCompare(b.product_id));

  const card = {};

  for (const field of [
    'cardholderName',
    'cardNumber',
    'expiryMonth',
    'expiryYear',
    'cvv',
    'billingAddress',
    'city',
    'postalCode',
    'country',
  ]) {
    card[field] = text(body.card?.[field], 200, field);
  }

  const digits = card.cardNumber.replace(/ /g, '');
  const month = Number(card.expiryMonth);
  const year = Number(card.expiryYear);

  if (
    !/^\d{16}$/.test(digits) ||
    !/^\d{3}$/.test(card.cvv) ||
    !/^\d{1,2}$/.test(card.expiryMonth) ||
    !/^\d{4}$/.test(card.expiryYear) ||
    month < 1 ||
    month > 12 ||
    year > new Date().getFullYear() + 20 ||
    Date.UTC(year, month, 1) <= Date.now()
  ) {
    throw fail(400, 'Tarjeta o vencimiento inválidos.');
  }

  const address = {
    billingAddress: card.billingAddress,
    city: card.city,
    postalCode: card.postalCode,
    country: card.country,
  };

  if (
    !Number.isSafeInteger(body.expectedCents) ||
    body.expectedCents < 1
  ) {
    throw fail(400, 'Total inválido. Actualiza el carrito.');
  }

  return {
    name,
    email,
    items,
    card,
    address,
    expectedCents: body.expectedCents,
  };
}

// No modifica la autenticación del checkout de usuarios registrados.
router.post(
  '/guest-checkout',
  sameOrigin,
  limited,
  wrap(async (req, res) => {
    const key = req.get('Idempotency-Key') || '';

    if (!/^[0-9a-f-]{36}$/i.test(key)) {
      throw fail(400, 'Falta la clave de la compra.');
    }

    const {
      name,
      email,
      items,
      card,
      address,
      expectedCents,
    } = validateGuest(req.body);

    const keyHash = hash(key);

    const requestHash = hash(
      JSON.stringify({
        name,
        email,
        items,
        address,
        expectedCents,
      }),
    );

    const result = await transaction(async db => {
      // Serializa los reintentos de la misma compra.
      await db.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [keyHash],
      );

      const prior = await db.query(
        `SELECT request_hash, response
         FROM guest_receipts
         WHERE key_hash=$1`,
        [keyHash],
      );

      if (prior.rows.length) {
        if (prior.rows[0].request_hash !== requestHash) {
          throw fail(
            409,
            'Esta compra ya se procesó con otros datos.',
          );
        }

        return prior.rows[0].response;
      }

      // Bloquea los productos durante la transacción.
      const products = await db.query(
        `SELECT id, name, price, stock
         FROM products
         WHERE id=ANY($1::varchar[])
         ORDER BY id
         FOR UPDATE`,
        [items.map(item => item.product_id)],
      );

      let cents = 0;

      const cartItems = items.map(item => {
        const product = products.rows.find(
          p => p.id === item.product_id,
        );

        if (!product || product.stock < item.quantity) {
          throw fail(
            409,
            'Un producto ya no tiene stock. Actualiza el carrito.',
          );
        }

        const priceCents = Math.round(
          Number(product.price) * 100,
        );

        if (
          !Number.isSafeInteger(priceCents) ||
          priceCents < 0
        ) {
          throw fail(409, 'Precio no disponible.');
        }

        cents += priceCents * item.quantity;

        return {
          ...item,
          name: product.name,
          price: Number(product.price),
        };
      });

      // El total verdadero siempre sale de la base de datos.
      if (cents !== expectedCents) {
        throw fail(
          409,
          'El precio cambió. Recarga la página antes de confirmar.',
        );
      }

      if (cents > 99999999) {
        throw fail(400, 'El total supera el límite por pedido.');
      }

      const payment = await chargeCard(
        buildGatewayPayload({
          orderReference: keyHash,
          amount: cents / 100,
          cartItems,
          card,
          billing: card,
        }),
      );

      if (!payment.approved) {
        throw fail(
          402,
          payment.declineMessage || 'Pago rechazado.',
        );
      }

      const order = (
        await db.query(
          `INSERT INTO orders(user_id,total,status)
           VALUES(NULL,$1,'pagado')
           RETURNING id,total,created_at`,
          [cents / 100],
        )
      ).rows[0];

      // SFTWRKEY-417: primera fila del historial de estados
      await db.query(
        `INSERT INTO order_status_history(order_id,from_status,to_status)
         VALUES($1,NULL,'pagado')`,
        [order.id],
      );

      for (const item of cartItems) {
        await db.query(
          'UPDATE products SET stock=stock-$1 WHERE id=$2',
          [item.quantity, item.product_id],
        );

        await db.query(
          `INSERT INTO order_items
           (order_id,product_id,quantity,unit_price)
           VALUES($1,$2,$3,$4)`,
          [
            order.id,
            item.product_id,
            item.quantity,
            item.price,
          ],
        );
      }

      const response = {
        success: true,
        order: {
          ...order,
          total: Number(order.total),
        },
        payment: {
          brand: payment.brand,
          last4: payment.last4,
          transactionId: payment.transactionId,
        },
      };

      // No se guarda el número completo de tarjeta ni el CVV.
      await db.query(
        `INSERT INTO guest_receipts
         (
           key_hash,request_hash,order_id,
           guest_name,guest_email,address,response
         )
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          keyHash,
          requestHash,
          order.id,
          name,
          email,
          address,
          response,
        ],
      );

      return response;
    });

    res.status(201).json(result);
  }),
);

// Recupera el comprobante si se perdió la respuesta de una compra.
router.post(
  '/guest-checkout/status',
  sameOrigin,
  limited,
  wrap(async (req, res) => {
    const key = req.get('Idempotency-Key') || '';

    if (!/^[0-9a-f-]{36}$/i.test(key)) {
      throw fail(400, 'Clave inválida.');
    }

    const result = await pool.query(
      'SELECT response FROM guest_receipts WHERE key_hash=$1',
      [hash(key)],
    );

    res.set('Cache-Control', 'no-store').json({
      receipt: result.rows[0]?.response || null,
    });
  }),
);

async function verifyGoogle(req) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw fail(503, 'Google aún no está configurado.');
  }

  const credential = text(
    req.body?.credential,
    12000,
    'la credencial',
  );

  const nonce = text(req.body?.nonce, 100, 'el nonce');

  let payload;

  try {
    const ticket = await google.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    payload = ticket.getPayload();
  } catch {
    throw fail(401, 'Google no pudo verificar tu identidad.');
  }

  if (
    !payload?.sub ||
    !payload.email_verified ||
    payload.nonce !== nonce
  ) {
    throw fail(401, 'Respuesta de Google inválida.');
  }

  return {
    sub: payload.sub,
    email: text(payload.email, 150, 'el correo').toLowerCase(),
    name: String(payload.name || payload.email).slice(0, 100),
    tokenHash: hash(credential),
    exp: payload.exp,
  };
}

async function consumeGoogle(db, identity) {
  await db.query(
    'DELETE FROM google_used_tokens WHERE expires_at < NOW()',
  );

  const result = await db.query(
    `INSERT INTO google_used_tokens
     VALUES($1,to_timestamp($2))
     ON CONFLICT DO NOTHING
     RETURNING token_hash`,
    [identity.tokenHash, identity.exp],
  );

  if (!result.rows.length) {
    throw fail(
      401,
      'Respuesta ya utilizada. Vuelve a pulsar Google.',
    );
  }
}

router.post(
  '/auth/google',
  sameOrigin,
  limited,
  wrap(async (req, res) => {
    const identity = await verifyGoogle(req);

    const result = await transaction(async db => {
      await consumeGoogle(db, identity);

      let user = (
        await db.query(
          `SELECT u.id,u.name,u.email,r.nombre AS role
           FROM google_accounts g
           JOIN users u ON u.id=g.user_id
           JOIN rol r ON r.id_rol=u.role
           WHERE g.google_sub=$1`,
          [identity.sub],
        )
      ).rows[0];

      if (!user) {
        const existing = await db.query(
          'SELECT id FROM users WHERE LOWER(email)=$1',
          [identity.email],
        );

        // No vincula una cuenta existente solo por compartir correo.
        if (existing.rows.length) {
          throw fail(
            409,
            'Entra con tu contraseña y vincula Google desde Mi cuenta.',
          );
        }

        const password = await bcrypt.hash(
          randomBytes(48).toString('hex'),
          12,
        );

        user = (
          await db.query(
            `INSERT INTO users(name,email,password,role)
             VALUES(
               $1,$2,$3,
               (SELECT id_rol FROM rol WHERE nombre='CLIENTE')
             )
             RETURNING id,name,email`,
            [identity.name, identity.email, password],
          )
        ).rows[0];

        user.role = 'CLIENTE';

        await db.query(
          'INSERT INTO google_accounts VALUES($1,$2)',
          [identity.sub, user.id],
        );
      }

      return {
        user,
        token: signToken(user),
      };
    });

    res.json({
      success: true,
      ...result,
    });
  }),
);

router.post(
  '/auth/google/link',
  sameOrigin,
  authenticate,
  limited,
  wrap(async (req, res) => {
    const identity = await verifyGoogle(req);

    await transaction(async db => {
      const user = (
        await db.query(
          'SELECT email,password FROM users WHERE id=$1 FOR UPDATE',
          [req.user.id],
        )
      ).rows[0];

      if (
        !user ||
        typeof req.body.password !== 'string' ||
        req.body.password.length > 200 ||
        !(await bcrypt.compare(
          req.body.password,
          user.password,
        ))
      ) {
        throw fail(401, 'Contraseña actual incorrecta.');
      }

      if (user.email.toLowerCase() !== identity.email) {
        throw fail(
          409,
          'Selecciona el mismo correo de tu cuenta.',
        );
      }

      await consumeGoogle(db, identity);

      const existing = (
        await db.query(
          'SELECT google_sub FROM google_accounts WHERE user_id=$1',
          [req.user.id],
        )
      ).rows[0];

      if (existing) {
        if (existing.google_sub !== identity.sub) {
          throw fail(
            409,
            'La cuenta ya tiene otro Google vinculado.',
          );
        }
      } else {
        await db.query(
          'INSERT INTO google_accounts VALUES($1,$2)',
          [identity.sub, req.user.id],
        );
      }
    });

    res.json({ success: true });
  }),
);

router.get(
  '/admin/alerts',
  authenticate,
  requireRoles('ADMIN'),
  wrap(async (req, res) => {
    const configured = Number(
      process.env.LOW_STOCK_THRESHOLD ?? 3,
    );

    const threshold =
      Number.isInteger(configured) && configured >= 0
        ? configured
        : 3;

    const lowStock = await pool.query(
      `SELECT id,name,stock
       FROM products
       WHERE stock <= $1
       ORDER BY stock,id`,
      [threshold],
    );

    const events = await pool.query(
      `SELECT
         e.id::text AS id,
         o.id AS order_id,
         o.total,
         o.created_at
       FROM admin_order_events e
       JOIN orders o ON o.id=e.order_id
       WHERE NOT EXISTS (
         SELECT 1 FROM admin_event_reads r
         WHERE r.event_id=e.id AND r.user_id=$1
       )
       ORDER BY e.id
       LIMIT 50`,
      [req.user.id],
    );

    res.set('Cache-Control', 'no-store').json({
      threshold,
      lowStock: lowStock.rows,
      events: events.rows,
    });
  }),
);

router.post(
  '/admin/alerts/read',
  sameOrigin,
  authenticate,
  requireRoles('ADMIN'),
  wrap(async (req, res) => {
    const ids = req.body?.ids;

    if (
      !Array.isArray(ids) ||
      ids.length > 50 ||
      ids.some(
        id =>
          typeof id !== 'string' ||
          !/^\d{1,18}$/.test(id),
      )
    ) {
      throw fail(400, 'Identificadores inválidos.');
    }

    await pool.query(
      `INSERT INTO admin_event_reads(user_id,event_id)
       SELECT $1,id
       FROM admin_order_events
       WHERE id=ANY($2::bigint[])
       ON CONFLICT DO NOTHING`,
      [req.user.id, ids],
    );

    res.json({ success: true });
  }),
);

export default router;