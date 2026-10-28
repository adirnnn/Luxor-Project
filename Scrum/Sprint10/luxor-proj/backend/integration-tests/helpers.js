// Utilidades compartidas por las pruebas de integración y regresión.
// A diferencia de las pruebas unitarias, aquí no hay dobles: la API Express real
// corre en un puerto libre y consulta una base PostgreSQL real.
import './env.js';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pool from '../db.js';
import app from '../server.js';
import { gateway } from '../services/paymentGateway.js';
import { signPayload } from '../services/webhookSignature.js';

export { pool };

// Credenciales del administrador que crea seed.js 
export const SEED_ADMIN = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };

// SFTWRKEY-445: Recurrente simulado. Las pruebas nunca llaman a la API real: crear un checkout
// devuelve un enlace falso y cada prueba decide si el cliente pagó, se rindió o se le venció.
const checkouts = new Map();
let nextCheckout = 0;

gateway.createCheckout = async (request) => {
  // único entre corridas: la base de pruebas local guarda los pagos de corridas anteriores
  const id = `ch_test_${++nextCheckout}_${randomUUID().slice(0, 8)}`;
  checkouts.set(id, { status: 'unpaid', request });
  return { id, url: `https://recurrente.test/checkout-session/${id}`, status: 'unpaid' };
};

gateway.getCheckout = async (id) => {
  const checkout = checkouts.get(id);
  if (!checkout) throw new Error(`Checkout de prueba desconocido: ${id}`);
  const paid = checkout.status === 'paid';
  return {
    id,
    url: null,
    status: checkout.status,
    paymentId: paid ? `pa_${id}` : null,
    brand: paid ? 'VISA' : null,
    last4: paid ? '4242' : null,
    failureReason: checkout.failureReason ?? null,
  };
};

const gatewayIdOf = async (reference) =>
  (await pool.query('SELECT gateway_checkout_id FROM checkout_sessions WHERE id = $1', [reference])).rows[0]
    ?.gateway_checkout_id;

export const fakeGateway = {
  checkoutId: gatewayIdOf,
  // lo que el backend le mandó a Recurrente al crear el checkout
  request: async (reference) => checkouts.get(await gatewayIdOf(reference))?.request,
  pay: async (reference) => {
    checkouts.get(await gatewayIdOf(reference)).status = 'paid';
  },
  decline: async (reference, failureReason = 'Fondos insuficientes') => {
    Object.assign(checkouts.get(await gatewayIdOf(reference)), { failureReason });
  },
  expire: async (reference) => {
    checkouts.get(await gatewayIdOf(reference)).status = 'expired';
  },
  inProgress: async (reference) => {
    checkouts.get(await gatewayIdOf(reference)).status = 'payment_in_progress';
  },
};

// SFTWRKEY-446: manda un webhook como lo haría Recurrente, firmado con el secreto de pruebas
// (o con otro, para probar firmas inválidas). Devuelve el status y el cuerpo de la respuesta.
export async function sendWebhook(event, { id = `msg_${randomUUID()}`, secret = process.env.RECURRENTE_WEBHOOK_SECRET, timestamp } = {}) {
  const body = JSON.stringify(event);
  const ts = timestamp ?? String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${baseUrl}/webhooks/recurrente`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': id,
      'svix-timestamp': ts,
      'svix-signature': `v1,${signPayload({ secret, id, timestamp: ts, body })}`,
    },
    body,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// Dirección de envío que pide el formulario (ya no lleva datos de tarjeta)
export const addressPayload = {
  billingAddress: 'Zona 10',
  city: 'Guatemala',
  postalCode: '01010',
  country: 'Guatemala',
};

const uniqueSuffix = () => randomUUID().slice(0, 8);

let server;
let baseUrl;

export async function startServer() {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

// URL completa de una ruta (para las peticiones que no son JSON, como subir una foto)
export const apiUrl = (path) => `${baseUrl}${path}`;

export async function stopServer() {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

// Petición HTTP real contra la API; devuelve status y cuerpo ya parseado.
export async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, body: data };
}

// SFTWRKEY-451: el token ya no viene en la respuesta del login, solo en la cookie de sesión.
// Las pruebas lo sacan de la cookie y lo mandan como Bearer (igual de válido para el backend).
export async function login(email, password) {
  const res = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Login falló para ${email}: ${res.status}`);
  const cookie = res.headers.get('set-cookie') || '';
  const token = decodeURIComponent(cookie.match(/luxor_sesion=([^;]+)/)?.[1] || '');
  return { ...(await res.json()), token };
}

export const loginAdmin = async () => (await login(SEED_ADMIN.email, SEED_ADMIN.password)).token;

// Registra un cliente nuevo por la API y devuelve { id, email, password, token }.
export async function registerClient(createdUsers) {
  const email = `it-${uniqueSuffix()}@prueba.com`;
  const password = 'clave-segura-123';
  const res = await api('POST', '/register', { body: { name: 'Cliente Integración', email, password } });
  if (res.status !== 201) throw new Error(`Registro falló: ${res.status} ${JSON.stringify(res.body)}`);
  createdUsers?.push(res.body.user.id);
  const { token } = await login(email, password);
  return { id: res.body.user.id, email, password, token };
}

// Inserta un producto directo en la base (dato de prueba aislado del catálogo).
export async function insertProduct(createdProducts, overrides = {}) {
  const product = {
    id: `it-${uniqueSuffix()}`,
    name: `Perfume Prueba ${uniqueSuffix()}`,
    price: 100,
    stock: 5,
    salida: 'Bergamota',
    corazon: 'Rosa',
    fondo: 'Ámbar',
    category_id: 2,
    ...overrides,
  };
  await pool.query(
    `INSERT INTO products (id, name, price, description, stock, salida, corazon, fondo, category_id, brand)
     VALUES ($1, $2, $3, 'Producto creado por pruebas automatizadas', $4, $5, $6, $7, $8, 'Pruebas')`,
    [product.id, product.name, product.price, product.stock, product.salida, product.corazon, product.fondo, product.category_id]
  );
  createdProducts?.push(product.id);
  return product;
}

// Compra completa con cuenta: llena el carrito, abre el pago, Recurrente lo aprueba y el cliente
// vuelve a la tienda. Devuelve la respuesta de /checkout/confirm (o la del checkout si falló).
export async function buyWithAccount(client, items, extraBody = addressPayload) {
  await api('POST', `/cart/${client.id}`, { token: client.token, body: items });
  const checkout = await api('POST', `/checkout/${client.id}`, { token: client.token, body: extraBody });
  if (checkout.status !== 201) return checkout;
  await fakeGateway.pay(checkout.body.reference);
  return api('POST', '/checkout/confirm', { body: { reference: checkout.body.reference } });
}

export async function productStock(id) {
  const { rows } = await pool.query('SELECT stock FROM products WHERE id = $1', [id]);
  return rows[0]?.stock;
}

// Limpia los datos creados respetando las llaves foráneas:
// pagos -> órdenes (order_items en cascada) -> usuarios (carrito en cascada) -> productos.
export async function cleanup({ users = [], products = [] }) {
  if (users.length) {
    await pool.query('DELETE FROM payments WHERE user_id = ANY($1::int[])', [users]).catch(() => {});
    await pool.query('DELETE FROM orders WHERE user_id = ANY($1::int[])', [users]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [users]);
  }
  if (products.length) {
    await pool.query('DELETE FROM order_items WHERE product_id = ANY($1::varchar[])', [products]);
    await pool.query('DELETE FROM products WHERE id = ANY($1::varchar[])', [products]);
  }
}
