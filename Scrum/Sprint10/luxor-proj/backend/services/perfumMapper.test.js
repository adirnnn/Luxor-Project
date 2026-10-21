import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapExternalPerfumeToProduct, EXTERNAL_SOURCE } from './perfumMapper.js';

test('mapExternalPerfumeToProduct: mapea los campos básicos de PerfumAPI', () => {
  const externo = {
    id: 'ext-123',
    name: 'Khamrah',
    brand: 'Lattafa',
    image_url: 'https://cdn.example.com/khamrah.jpg',
    description: 'Un oriental especiado',
    notes_top: ['Canela', 'Nuez moscada'],
    notes_middle: ['Dátil', 'Ámbar'],
    notes_base: ['Vainilla', 'Almizcle'],
  };

  const producto = mapExternalPerfumeToProduct(externo);

  assert.equal(producto.name, 'Khamrah');
  assert.equal(producto.brand, 'Lattafa');
  assert.equal(producto.image, 'https://cdn.example.com/khamrah.jpg');
  assert.equal(producto.description, 'Un oriental especiado');
  assert.deepEqual(producto.notes, {
    salida: 'Canela, Nuez moscada',
    corazon: 'Dátil, Ámbar',
    fondo: 'Vainilla, Almizcle',
  });
  assert.equal(producto.external_source, EXTERNAL_SOURCE);
  assert.equal(producto.external_id, 'ext-123');
});

test('mapExternalPerfumeToProduct: nunca trae id/price/stock/category_id (los define el admin)', () => {
  const producto = mapExternalPerfumeToProduct({ id: 'x', name: 'Test' });
  assert.equal('id' in producto, false);
  assert.equal('price' in producto, false);
  assert.equal('stock' in producto, false);
  assert.equal('category_id' in producto, false);
});

test('mapExternalPerfumeToProduct: campos ausentes caen a valores por defecto vacíos', () => {
  const producto = mapExternalPerfumeToProduct({});
  assert.equal(producto.name, '');
  assert.equal(producto.brand, '');
  assert.equal(producto.image, '');
  assert.equal(producto.description, '');
  assert.deepEqual(producto.notes, { salida: '', corazon: '', fondo: '' });
  assert.equal(producto.external_id, null);
});

test('mapExternalPerfumeToProduct: soporta un objeto externo nulo/indefinido sin lanzar', () => {
  assert.doesNotThrow(() => mapExternalPerfumeToProduct(null));
  assert.doesNotThrow(() => mapExternalPerfumeToProduct(undefined));
  const producto = mapExternalPerfumeToProduct(undefined);
  assert.equal(producto.name, '');
});

test('mapExternalPerfumeToProduct: ignora notas vacías/falsy al unirlas', () => {
  const producto = mapExternalPerfumeToProduct({
    name: 'Test',
    notes_top: ['Bergamota', '', null, undefined],
  });
  assert.equal(producto.notes.salida, 'Bergamota');
});

test('mapExternalPerfumeToProduct: notes_* que no son arreglo se tratan como vacío', () => {
  const producto = mapExternalPerfumeToProduct({ name: 'Test', notes_top: 'no-es-un-array' });
  assert.equal(producto.notes.salida, '');
});

test('mapExternalPerfumeToProduct: synced_at es una fecha ISO válida y reciente', () => {
  const antes = Date.now();
  const producto = mapExternalPerfumeToProduct({ name: 'Test' });
  const despues = Date.now();
  const timestamp = new Date(producto.synced_at).getTime();

  assert.equal(producto.synced_at, new Date(producto.synced_at).toISOString());
  assert.ok(timestamp >= antes && timestamp <= despues);
});