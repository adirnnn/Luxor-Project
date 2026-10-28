// SFTWRKEY-453: IP del cliente detrás de Vercel → Cloudflare → Render, y el límite de intentos.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clientIp, connectingIp } from './clientIp.js';
import { rateLimit, CONNECTION_LIMIT_FACTOR } from './rateLimit.js';

// petición como la recibe Express detrás de Render (req.ip = última IP, por "trust proxy" 1)
const peticion = ({ xff, cf, ip = '10.0.0.1', path = '/login' } = {}) => {
  const headers = {};
  if (xff) headers['x-forwarded-for'] = xff;
  if (cf) headers['cf-connecting-ip'] = cf;
  return { ip, path, headers, get: (nombre) => headers[nombre.toLowerCase()] };
};

const intentar = (limiter, req) => {
  let paso = false;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json() { return this; } };
  limiter(req, res, () => { paso = true; });
  return paso ? 200 : res.statusCode;
};

let n = 0;
const edgeDeCloudflare = () => `172.70.${n % 250}.${(n++ % 200) + 1}`;

test('clientIp: por el sitio es la primera IP de X-Forwarded-For (la que pone Vercel)', () => {
  assert.equal(clientIp(peticion({ xff: '190.56.12.34, 76.76.21.9, 172.70.1.2' })), '190.56.12.34');
  assert.equal(clientIp(peticion({ xff: '2800:98:1::5, 172.70.1.2' })), '2800:98:1::5');
});

test('clientIp: sin X-Forwarded-For o con basura usa la conexión (local y pruebas)', () => {
  assert.equal(clientIp(peticion({ ip: '127.0.0.1' })), '127.0.0.1');
  assert.equal(clientIp(peticion({ xff: '<script>, 1.2.3.4', ip: '127.0.0.1' })), '127.0.0.1');
  assert.equal(clientIp({ ip: '192.168.1.10', path: '/login' }), '192.168.1.10');
});

test('connectingIp: la IP que se conectó a Cloudflare, o la conexión si no hay Cloudflare', () => {
  assert.equal(connectingIp(peticion({ cf: '76.76.21.9' })), '76.76.21.9');
  assert.equal(connectingIp(peticion({ cf: 'no-es-ip', ip: '127.0.0.1' })), '127.0.0.1');
  assert.equal(connectingIp(peticion({ ip: '127.0.0.1' })), '127.0.0.1');
});

test('el error de producción: aunque la última IP (Cloudflare) cambie en cada intento, el 11.º login se bloquea', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 10 });
  const resultados = [];
  for (let i = 0; i < 11; i++) {
    const edge = edgeDeCloudflare();
    // así llega por el sitio: visitante, Vercel, Cloudflare (req.ip = la de Cloudflare)
    resultados.push(intentar(limiter, peticion({ xff: `190.56.12.34, 76.76.21.9, ${edge}`, cf: '76.76.21.9', ip: edge })));
  }
  assert.deepEqual(resultados, [...Array(10).fill(200), 429]);
});

test('directo a Render sin inventar nada: el 11.º login se bloquea', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 10 });
  const resultados = [];
  for (let i = 0; i < 11; i++) {
    const edge = edgeDeCloudflare();
    resultados.push(intentar(limiter, peticion({ xff: `201.204.5.6, ${edge}`, cf: '201.204.5.6', ip: edge })));
  }
  assert.equal(resultados.at(-1), 429);
});

test('quien llama directo a Render inventando la primera IP queda frenado por su IP real (CF-Connecting-IP)', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 10 });
  const tope = 10 * CONNECTION_LIMIT_FACTOR;
  const resultados = [];
  for (let i = 0; i < tope + 1; i++) {
    // cada intento con una IP inventada distinta, pero Cloudflare sabe quién se conectó de verdad
    resultados.push(intentar(limiter, peticion({ xff: `10.9.${i}.${i}, 198.51.100.66, ${edgeDeCloudflare()}`, cf: '198.51.100.66' })));
  }
  assert.equal(resultados.filter((s) => s === 200).length, tope);
  assert.equal(resultados.at(-1), 429);
});

test('dos clientes que entran por el mismo servidor de Vercel tienen cada uno su límite', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 10 });
  const ana = () => intentar(limiter, peticion({ xff: `190.1.1.1, 76.76.21.9, ${edgeDeCloudflare()}`, cf: '76.76.21.9' }));
  const beto = () => intentar(limiter, peticion({ xff: `190.2.2.2, 76.76.21.9, ${edgeDeCloudflare()}`, cf: '76.76.21.9' }));

  for (let i = 0; i < 10; i++) ana();
  assert.equal(ana(), 429, 'Ana llegó a su límite');
  assert.equal(beto(), 200, 'Beto no queda bloqueado por los intentos de Ana');
});
