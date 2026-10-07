// Regresión R1 — Búsqueda de perfumes (GET /products/search).
// Comportamiento validado que se protege: la búsqueda solo muestra perfumes con
// stock disponible, no distingue mayúsculas/minúsculas y también busca en las notas.
// Cambio que lo rompería: modificar el filtro "p.stock > 0" (p. ej. ">= 0" o quitarlo)
// o cambiar ILIKE por LIKE al refactorizar la consulta.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, api, insertProduct, cleanup } from './helpers.js';

const created = { products: [] };
// Palabra única para que la búsqueda solo encuentre los productos de esta prueba.
const marca = `Regresion${Date.now()}`;
let disponible;
let agotado;

before(async () => {
  await startServer();
  disponible = await insertProduct(created.products, { name: `${marca} Disponible`, stock: 4 });
  agotado = await insertProduct(created.products, { name: `${marca} Agotado`, stock: 0 });
});
after(async () => {
  await cleanup(created);
  await stopServer();
});

const buscar = (texto) => api('GET', `/products/search?busqueda=${encodeURIComponent(texto)}`);

test('la búsqueda no muestra perfumes agotados (stock = 0)', async () => {
  const res = await buscar(marca);

  assert.equal(res.status, 200);
  const ids = res.body.products.map((p) => p.id);
  assert.ok(ids.includes(disponible.id), 'el perfume con stock debe aparecer');
  assert.ok(!ids.includes(agotado.id), 'un perfume agotado no debe aparecer en la búsqueda');
  assert.equal(ids.length, 1);
});

test('la búsqueda no distingue mayúsculas de minúsculas', async () => {
  const res = await buscar(marca.toUpperCase());
  assert.equal(res.status, 200);
  assert.ok(res.body.products.some((p) => p.id === disponible.id), 'debe encontrarlo aunque cambien las mayúsculas');
});

test('la búsqueda también encuentra por notas olfativas', async () => {
  const nota = `Nota${marca}`;
  const conNota = await insertProduct(created.products, { name: 'Perfume Notas', stock: 2, corazon: nota });

  const res = await buscar(nota.toLowerCase());
  assert.deepEqual(res.body.products.map((p) => p.id), [conNota.id]);
});

test('sin texto de búsqueda responde 400', async () => {
  const res = await buscar('   ');
  assert.equal(res.status, 400);
});
