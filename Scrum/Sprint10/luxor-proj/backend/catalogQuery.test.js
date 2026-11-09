// SFTWRKEY-424 / SFTWRKEY-450: consulta del catálogo público
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogQuery, parseCatalogParams } from './services/catalogQuery.js';

test('el catálogo incluye los agotados, pero siempre al final', () => {
  for (const sort of ['newest', 'price_asc', 'price_desc', 'name']) {
    const { listSql, countSql } = buildCatalogQuery(parseCatalogParams({ sort }));
    assert.doesNotMatch(listSql, /WHERE[^]*p\.stock > 0[^]*ORDER BY/, `${sort}: no debe filtrar por stock`);
    assert.doesNotMatch(countSql, /stock/, `${sort}: el total cuenta también los agotados`);
    assert.match(listSql, /ORDER BY \(p\.stock > 0\) DESC, /, `${sort}: primero los que tienen stock`);
  }
});

test('los filtros siguen usando parámetros', () => {
  const { listSql, listValues, countValues } = buildCatalogQuery(
    parseCatalogParams({ q: 'oud', brand: 'Lattafa', category: '2', minPrice: '100', maxPrice: '500', page: '2', pageSize: '12' })
  );
  assert.match(listSql, /WHERE TRUE AND \(p\.name ILIKE \$1/);
  assert.deepEqual(countValues, ['%oud%', 'Lattafa', 2, 100, 500]);
  assert.deepEqual(listValues.slice(-2), [12, 12]);
});
