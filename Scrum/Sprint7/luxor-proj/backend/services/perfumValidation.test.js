import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMappedPerfume } from './perfumValidation.js';

const base = () => ({
  name: 'Khamrah',
  brand: 'Lattafa',
  image: 'https://cdn.example.com/khamrah.jpg',
  description: 'Un oriental especiado',
  notes: { salida: 'Canela', corazon: 'Dátil', fondo: 'Vainilla' },
  external_source: 'perfumapi',
  external_id: 'ext-1',
  synced_at: new Date().toISOString(),
});

test('validateMappedPerfume: candidato completo es válido y no genera warnings', () => {
  const { ok, candidate, warnings } = validateMappedPerfume(base());
  assert.equal(ok, true);
  assert.deepEqual(warnings, []);
  assert.equal(candidate.name, 'Khamrah');
});

test('validateMappedPerfume: sin nombre es inválido y no se puede mostrar', () => {
  const mapped = { ...base(), name: '' };
  const { ok, warnings } = validateMappedPerfume(mapped);
  assert.equal(ok, false);
  assert.match(warnings[0], /nombre/i);
});

test('validateMappedPerfume: nombre solo con espacios también es inválido', () => {
  const mapped = { ...base(), name: '   ' };
  const { ok } = validateMappedPerfume(mapped);
  assert.equal(ok, false);
});

test('validateMappedPerfume: imagen inválida se limpia y agrega warning, pero sigue siendo válido', () => {
  const mapped = { ...base(), image: 'no-es-una-url' };
  const { ok, candidate, warnings } = validateMappedPerfume(mapped);
  assert.equal(ok, true);
  assert.equal(candidate.image, '');
  assert.ok(warnings.some((w) => /imagen/i.test(w)));
});

test('validateMappedPerfume: rechaza protocolos que no sean http/https en la imagen', () => {
  const mapped = { ...base(), image: 'javascript:alert(1)' };
  const { candidate, warnings } = validateMappedPerfume(mapped);
  assert.equal(candidate.image, '');
  assert.ok(warnings.some((w) => /imagen/i.test(w)));
});

test('validateMappedPerfume: sin descripción aplica un texto por defecto y warning', () => {
  const mapped = { ...base(), description: '' };
  const { candidate, warnings } = validateMappedPerfume(mapped);
  assert.equal(candidate.description, 'Descripción no disponible desde PerfumAPI.');
  assert.ok(warnings.some((w) => /descripción/i.test(w)));
});

test('validateMappedPerfume: sin marca aplica "Sin marca" y warning', () => {
  const mapped = { ...base(), brand: '' };
  const { candidate, warnings } = validateMappedPerfume(mapped);
  assert.equal(candidate.brand, 'Sin marca');
  assert.ok(warnings.some((w) => /marca/i.test(w)));
});

test('validateMappedPerfume: sin ninguna nota olfativa agrega warning', () => {
  const mapped = { ...base(), notes: { salida: '', corazon: '', fondo: '' } };
  const { ok, warnings } = validateMappedPerfume(mapped);
  assert.equal(ok, true);
  assert.ok(warnings.some((w) => /notas/i.test(w)));
});

test('validateMappedPerfume: basta con una sola nota presente para no advertir sobre notas', () => {
  const mapped = { ...base(), notes: { salida: 'Bergamota', corazon: '', fondo: '' } };
  const { warnings } = validateMappedPerfume(mapped);
  assert.equal(warnings.some((w) => /notas/i.test(w)), false);
});

test('validateMappedPerfume: no muta el objeto original que recibe', () => {
  const mapped = { ...base(), image: 'no-es-una-url' };
  const original = { ...mapped, notes: { ...mapped.notes } };
  validateMappedPerfume(mapped);
  assert.deepEqual(mapped, original);
});

test('validateMappedPerfume: acumula varios warnings a la vez', () => {
  const mapped = { ...base(), image: '', description: '', brand: '', notes: { salida: '', corazon: '', fondo: '' } };
  const { ok, warnings } = validateMappedPerfume(mapped);
  assert.equal(ok, true);
  assert.equal(warnings.length, 4);
});