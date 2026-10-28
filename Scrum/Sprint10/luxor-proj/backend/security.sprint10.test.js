// SFTWRKEY-453: verificaciones finales de la matriz que solo tenían revisión de código (RC).
// SEC-14: CORS restringido al frontend. SEC-41: los logs no imprimen datos sensibles.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.JWT_SECRET = 'test-secret';
process.env.PAYMENT_GATEWAY_API_KEY = 'test_key_for_unit_tests';

const { default: app } = await import('./server.js');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// ── SEC-14: CORS ────────────────────────────────────────────────────────────

test('SEC-14: el preflight de otro sitio no recibe permiso de CORS; el del frontend sí', async () => {
  const preflight = (origin) => fetch(`${baseUrl}/login`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });

  const ajeno = await preflight('https://sitio-malicioso.com');
  assert.equal(ajeno.headers.get('access-control-allow-origin'), FRONTEND);
  assert.notEqual(ajeno.headers.get('access-control-allow-origin'), 'https://sitio-malicioso.com');
  assert.equal(ajeno.headers.get('access-control-allow-credentials'), null);

  const propio = await preflight(FRONTEND);
  assert.equal(propio.headers.get('access-control-allow-origin'), FRONTEND);
});

test('SEC-14: la API nunca responde Access-Control-Allow-Origin: * (ni para lecturas públicas)', async () => {
  for (const ruta of ['/products', '/categories', '/me']) {
    const res = await fetch(`${baseUrl}${ruta}`, { headers: { Origin: 'https://sitio-malicioso.com' } });
    assert.notEqual(res.headers.get('access-control-allow-origin'), '*', ruta);
    assert.notEqual(res.headers.get('access-control-allow-origin'), 'https://sitio-malicioso.com', ruta);
  }
});

// ── SEC-41: datos sensibles en los logs ─────────────────────────────────────

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const archivosDelBackend = (dir) =>
  readdirSync(dir).flatMap((nombre) => {
    const ruta = path.join(dir, nombre);
    if (['node_modules', 'chatbot', 'integration-tests', 'coverage', 'reports'].includes(nombre)) return [];
    if (statSync(ruta).isDirectory()) return archivosDelBackend(ruta);
    return nombre.endsWith('.js') && !nombre.endsWith('.test.js') ? [ruta] : [];
  });

test('SEC-41: ningún console.* del backend imprime el cuerpo de la petición, contraseñas, tokens ni datos de tarjeta', () => {
  const archivos = archivosDelBackend(backendDir);
  assert.ok(archivos.length > 20, 'se revisaron los archivos del backend');

  const PELIGROSO = /\b(req\.body|password|contrase|cardNumber|cvv|token|secret|req\.headers)\b/i;
  const encontrados = [];
  for (const archivo of archivos) {
    readFileSync(archivo, 'utf8').split('\n').forEach((linea, i) => {
      // solo las llamadas a console que imprimen algo más que un texto fijo y el mensaje del error
      const llamada = linea.match(/console\.(log|info|warn|error|debug)\((.*)$/);
      if (llamada && PELIGROSO.test(llamada[2].replace(/(['"`]).*?\1/g, ''))) {
        encontrados.push(`${path.relative(backendDir, archivo)}:${i + 1}: ${linea.trim()}`);
      }
    });
  }
  assert.deepEqual(encontrados, []);
});
