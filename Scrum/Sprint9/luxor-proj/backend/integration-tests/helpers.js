// Utilidades compartidas por las pruebas de integración y regresión.
// A diferencia de las pruebas unitarias, aquí no hay dobles: la API Express real
// corre en un puerto libre y consulta una base PostgreSQL real.
import './env.js';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pool from '../db.js';
import app from '../server.js';

export { pool };

// Credenciales del administrador que crea seed.js.
export const SEED_ADMIN = { email: 'admin@luxor.com', password: '123456' };

// Tarjetas de prueba de la pasarela simulada (services/paymentGateway.js).
export const APPROVED_CARD = '4242424242424242';
export const DECLINED_CARD = '4000000000000002';

export const cardPayload = (cardNumber = APPROVED_CARD) => ({
  cardholderName: 'Cliente Prueba',
  cardNumber,
  expiryMonth: '12',
  expiryYear: '2030',
  cvv: '123',
  billingAddress: 'Zona 10',
  city: 'Guatemala',
  postalCode: '01010',
  country: 'GT',
});

const uniqueSuffix = () => randomUUID().slice(0, 8);

let server;
let baseUrl;

export async function startServer() {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

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

export async function login(email, password) {
  const res = await api('POST', '/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`Login falló para ${email}: ${res.status}`);
  return res.body;
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
