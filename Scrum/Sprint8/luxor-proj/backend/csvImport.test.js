import test from "node:test";
import assert from "node:assert/strict";
import { CSV_TEMPLATE, validateCsv } from "./csvImport.js";

test("valida e interpreta un CSV de perfumes", () => {
  const result = validateCsv(CSV_TEMPLATE);
  assert.equal(result.totalRows, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.products[0].price, 425);
});

test("reporta columnas faltantes y valores inválidos", () => {
  assert.throws(() => validateCsv("id,name\na,b"), /Encabezados inválidos/);
  const invalid = CSV_TEMPLATE.replace("425.00", "-1").replace(",12,", ",-2,");
  const result = validateCsv(invalid);
  assert.equal(result.errors.length, 2);
});
