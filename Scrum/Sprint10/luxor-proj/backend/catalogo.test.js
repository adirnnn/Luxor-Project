// Catálogo base (data/catalogo.js) y cómo lo carga el seed (services/catalogSeed.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { catalogo, CATEGORIAS, SIN_FOTO } from './data/catalogo.js';
import { INSERT_CATALOGO, UPDATE_FOTOS, DELETE_RETIRADOS, seedCatalog, removeRetired } from './services/catalogSeed.js';
import { retirados } from './data/catalogoRetirados.js';
import { inventario } from './data/catalogoInventario.js';
import { isSafeImage } from './services/imageValidation.js';

const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));
const ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test('cada perfume tiene un id válido y no se repite', () => {
  const ids = catalogo.map((p) => p.id);
  assert.ok(ids.length >= 30);
  for (const id of ids) assert.match(id, ID_REGEX, id);
  assert.equal(new Set(ids).size, ids.length, 'hay ids repetidos');
});

test('incluye el inventario de la tienda y ningún nombre se repite', () => {
  assert.ok(catalogo.length >= 500, `solo hay ${catalogo.length} perfumes`);
  const nombres = catalogo.map((p) => p.name.toLowerCase());
  assert.equal(new Set(nombres).size, nombres.length, 'hay nombres repetidos');
});

test('cada perfume trae sus datos completos', () => {
  for (const p of catalogo) {
    for (const campo of ['name', 'brand', 'description']) {
      assert.ok(typeof p[campo] === 'string' && p[campo].trim(), `${p.id}: falta ${campo}`);
    }
    // las notas son opcionales: el catálogo de existencias de la tienda no las trae
    for (const campo of ['salida', 'corazon', 'fondo']) {
      assert.ok(p[campo] === null || (typeof p[campo] === 'string' && p[campo].trim()), `${p.id}: ${campo} vacío`);
    }
    assert.ok(p.name.length <= 200, `${p.id}: nombre muy largo`);
    assert.ok(Number.isFinite(p.price) && p.price > 0, `${p.id}: precio inválido`);
    assert.ok(Number.isInteger(p.stock) && p.stock >= 0, `${p.id}: stock inválido`);
  }
});

test('las categorías son las mismas que crea el seed', () => {
  const seed = readFileSync(new URL('./seed.js', import.meta.url), 'utf8');
  for (const categoria of CATEGORIAS) assert.ok(seed.includes(`('${categoria}')`), `el seed no crea ${categoria}`);
  for (const p of catalogo) assert.ok(CATEGORIAS.includes(p.category), `${p.id}: categoría ${p.category}`);
});

test('la foto es null, una foto local que existe o un link https (Cloudinary)', () => {
  assert.ok(existsSync(PUBLIC + SIN_FOTO), 'falta la imagen de relleno');
  for (const p of catalogo) {
    if (p.image === null) continue;
    assert.ok(isSafeImage(p.image), `${p.id}: foto inválida ${p.image}`);
    if (p.image.startsWith('/')) assert.ok(existsSync(PUBLIC + p.image), `${p.id}: no existe ${p.image}`);
    else assert.match(p.image, /^https:\/\//, `${p.id}: la foto debe ser https`);
  }
});

test('el seed manda todo el catálogo en una consulta y no toca los perfumes que ya existen', async () => {
  const consultas = [];
  const db = { query: async (sql, params) => { consultas.push({ sql, params }); return { rowCount: 0 }; } };

  const resultado = await seedCatalog(db);

  assert.equal(consultas.length, 2);
  assert.equal(consultas[0].sql, INSERT_CATALOGO);
  assert.match(INSERT_CATALOGO, /ON CONFLICT \(id\) DO NOTHING/);
  // la categoría se busca por nombre, no por un id fijo
  assert.match(INSERT_CATALOGO, /LEFT JOIN categories c ON c\.nombre = p\.category/);
  assert.deepEqual(JSON.parse(consultas[0].params[0]), catalogo);
  assert.equal(consultas[0].params[1], SIN_FOTO);
  assert.equal(resultado.total, catalogo.length);
});

test('las fotos del catálogo solo reemplazan la de relleno o una local, nunca una que puso el admin', async () => {
  const consultas = [];
  const db = { query: async (sql, params) => { consultas.push({ sql, params }); return { rowCount: 1 }; } };
  const conCloudinary = [{ ...catalogo[0], image: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/khamrah.jpg' }];

  const resultado = await seedCatalog(db, conCloudinary);

  assert.equal(consultas[1].sql, UPDATE_FOTOS);
  assert.equal(JSON.parse(consultas[1].params[0])[0].image, conCloudinary[0].image);
  assert.match(UPDATE_FOTOS, /p\.image IS NOT NULL/);
  assert.match(UPDATE_FOTOS, /pr\.image IS NULL OR pr\.image = \$2 OR pr\.image LIKE '\/assets\/products\/%'/);
  assert.equal(resultado.fotos, 1);
});

test('el inventario solo publica perfumes con foto, y los retirados no vuelven a entrar', () => {
  for (const p of inventario) assert.ok(p.image, `${p.id}: sin foto`);
  const ids = new Set(catalogo.map((p) => p.id));
  for (const id of retirados) assert.ok(!ids.has(id), `${id} está retirado pero sigue en el catálogo`);
});

test('los retirados se borran solo si siguen sin foto y no están en ningún pedido', async () => {
  const consultas = [];
  const db = { query: async (sql, params) => { consultas.push({ sql, params }); return { rowCount: 3 }; } };

  const resultado = await removeRetired(db, ['a', 'b', 'c']);

  assert.equal(resultado.borrados, 3);
  assert.equal(consultas[0].sql, DELETE_RETIRADOS);
  assert.deepEqual(consultas[0].params, [['a', 'b', 'c'], SIN_FOTO]);
  assert.match(DELETE_RETIRADOS, /p\.image IS NULL OR p\.image = \$2/);
  assert.match(DELETE_RETIRADOS, /NOT EXISTS \(SELECT 1 FROM order_items/);
});
