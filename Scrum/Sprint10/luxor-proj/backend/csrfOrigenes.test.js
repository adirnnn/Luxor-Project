// El sitio con dominio propio y con la dirección de Vercel: el backend acepta las dos
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, csrfProtection } from './services/csrf.js';

test('acepta FRONTEND_URL y las direcciones extra, sin importar la barra final', () => {
  const env = { FRONTEND_URL: 'https://perfumesvictoria.shop/', EXTRA_FRONTEND_URLS: ' https://www.perfumesvictoria.shop, https://luxor-project-green.vercel.app/ ,' };
  assert.deepEqual(allowedOrigins(env), [
    'https://perfumesvictoria.shop',
    'https://www.perfumesvictoria.shop',
    'https://luxor-project-green.vercel.app',
  ]);
  assert.deepEqual(allowedOrigins({}), ['http://localhost:5173']);
});

test('un POST desde una dirección del sitio pasa y desde otra se rechaza', () => {
  const antes = { ...process.env };
  process.env.FRONTEND_URL = 'https://perfumesvictoria.shop';
  process.env.EXTRA_FRONTEND_URLS = 'https://luxor-project-green.vercel.app';
  try {
    const correr = (origin) => {
      let siguio = false;
      const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json() { return this; } };
      csrfProtection({ method: 'POST', path: '/login', get: (h) => (h === 'origin' ? origin : undefined) }, res, () => { siguio = true; });
      return siguio ? 'pasa' : res.statusCode;
    };
    assert.equal(correr('https://perfumesvictoria.shop'), 'pasa');
    assert.equal(correr('https://luxor-project-green.vercel.app'), 'pasa');
    assert.equal(correr('https://otro-sitio.com'), 403);
  } finally {
    process.env = antes;
  }
});
