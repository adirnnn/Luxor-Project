// SFTWRKEY-409: política de contraseñas
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword } from './passwordPolicy.js';

test('rechaza contraseñas de menos de 12 caracteres', () => {
  assert.match(validatePassword('Secreta123'), /12 caracteres/);
});

test('acepta 12 caracteres exactos, con espacios y signos', () => {
  assert.equal(validatePassword('a'.repeat(12)), null);
  assert.equal(validatePassword('Mi perfume favorito!'), null);
});

test('rechaza más de 72 bytes porque bcrypt ignoraría el resto', () => {
  assert.equal(validatePassword('a'.repeat(72)), null);
  assert.match(validatePassword('a'.repeat(73)), /72 bytes/);
});

test('cuenta emojis como un carácter y los bytes reales', () => {
  assert.match(validatePassword('🔒'.repeat(11)), /12 caracteres/);
  assert.equal(validatePassword('🔒'.repeat(12)), null);
  assert.match(validatePassword('🔒'.repeat(19)), /72 bytes/);
});

test('rechaza valores que no son texto', () => {
  assert.match(validatePassword(null), /texto válido/);
  assert.match(validatePassword(123456789012), /texto válido/);
});
