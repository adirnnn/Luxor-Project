import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fillMonthlySeries,
  getGeneralMetrics,
  getMonthlySales,
  getSalesByCategory,
  getTopProducts,
  getInventoryByCategory,
} from './reportMetrics.js';

function mockDb(rows = []) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
      return { rows };
    },
  };
}

// fillMonthlySeries (función pura, sin base de datos)

test('fillMonthlySeries: rellena con 0 los meses sin ventas', () => {
  const reference = new Date(Date.UTC(2026, 2, 15)); // marzo 2026
  const series = fillMonthlySeries([], 3, reference);

  assert.deepEqual(series.map((s) => s.month), ['2026-01', '2026-02', '2026-03']);
  assert.ok(series.every((s) => s.orders === 0 && s.revenue === 0));
});

test('fillMonthlySeries: conserva los datos reales de los meses con ventas', () => {
  const reference = new Date(Date.UTC(2026, 2, 15));
  const rows = [{ month: '2026-02', orders: '4', revenue: '199.50' }];
  const series = fillMonthlySeries(rows, 3, reference);

  const feb = series.find((s) => s.month === '2026-02');
  assert.equal(feb.orders, 4);
  assert.equal(feb.revenue, 199.5);
  assert.equal(typeof feb.orders, 'number');
  assert.equal(typeof feb.revenue, 'number');
});

test('fillMonthlySeries: devuelve la serie ordenada ascendente por mes', () => {
  const reference = new Date(Date.UTC(2026, 2, 15));
  const series = fillMonthlySeries([], 3, reference);
  const meses = series.map((s) => s.month);
  const ordenados = [...meses].sort();
  assert.deepEqual(meses, ordenados);
});

test('fillMonthlySeries: filas fuera del rango esperado igual aparecen en el resultado', () => {
  // Caso defensivo: si llega una fila con un mes fuera de la ventana solicitada,
  // no debe perderse silenciosamente.
  const reference = new Date(Date.UTC(2026, 2, 15));
  const rows = [{ month: '2025-01', orders: '2', revenue: '50' }];
  const series = fillMonthlySeries(rows, 3, reference);

  assert.ok(series.some((s) => s.month === '2025-01'));
});

// getGeneralMetrics

test('getGeneralMetrics: convierte los conteos de string a number', async () => {
  const db = mockDb([{
    total_users: '10',
    total_products: '25',
    total_orders: '7',
    total_revenue: '1234.50',
    total_units_sold: '40',
    total_stock: '300',
  }]);

  const metrics = await getGeneralMetrics(db);

  assert.deepEqual(metrics, {
    totalUsers: 10,
    totalProducts: 25,
    totalOrders: 7,
    totalRevenue: 1234.5,
    totalUnitsSold: 40,
    totalStock: 300,
  });
});

test('getGeneralMetrics: si no hay filas, devuelve todo en 0 en vez de fallar', async () => {
  const db = mockDb([]);
  const metrics = await getGeneralMetrics(db);
  assert.deepEqual(metrics, {
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalUnitsSold: 0,
    totalStock: 0,
  });
});

// getMonthlySales

test('getMonthlySales: usa 12 meses por defecto y pasa el parámetro a la consulta', async () => {
  const db = mockDb([]);
  await getMonthlySales(undefined, db);
  assert.deepEqual(db.calls[0].params, [12]);
});

test('getMonthlySales: rellena la serie con los meses solicitados', async () => {
  const now = new Date();
  const mesActual = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const db = mockDb([{ month: mesActual, orders: '3', revenue: '90.00' }]);
  const sales = await getMonthlySales(6, db);
  assert.equal(sales.length, 6);
  assert.deepEqual(db.calls[0].params, [6]);
});

// getSalesByCategory

test('getSalesByCategory: mapea category/units/revenue como number', async () => {
  const db = mockDb([
    { category: 'Árabes', units: '15', revenue: '5850.00' },
    { category: 'Sin categoría', units: '2', revenue: '199.98' },
  ]);
  const sales = await getSalesByCategory(db);

  assert.deepEqual(sales, [
    { category: 'Árabes', units: 15, revenue: 5850 },
    { category: 'Sin categoría', units: 2, revenue: 199.98 },
  ]);
});

// getTopProducts

test('getTopProducts: usa 5 por defecto y respeta un límite personalizado', async () => {
  const db = mockDb([
    { product_id: 'khamrah', name: 'Khamrah', category: 'Árabes', units: '20', revenue: '7800.00' },
  ]);

  await getTopProducts(undefined, db);
  assert.deepEqual(db.calls[0].params, [5]);

  await getTopProducts(3, db);
  assert.deepEqual(db.calls[1].params, [3]);

  const products = await getTopProducts(5, db);
  assert.deepEqual(products[0], {
    product_id: 'khamrah', name: 'Khamrah', category: 'Árabes', units: 20, revenue: 7800,
  });
});

// getInventoryByCategory

test('getInventoryByCategory: convierte products/stock a number', async () => {
  const db = mockDb([{ category: 'Árabes', products: '12', stock: '340' }]);
  const inventory = await getInventoryByCategory(db);
  assert.deepEqual(inventory, [{ category: 'Árabes', products: 12, stock: 340 }]);
});