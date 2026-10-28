// SFTWRKEY-446: firma de los webhooks de Recurrente (Svix)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { signPayload, verifyWebhookSignature } from './webhookSignature.js';

const secret = `whsec_${Buffer.from('clave-de-prueba-de-32-bytes!!!!!').toString('base64')}`;
const now = 1_793_000_000_000;
const timestamp = String(now / 1000);
const id = 'msg_123';
const body = '{"event_type":"intent.succeeded","checkout":{"id":"ch_1"}}';
const signature = `v1,${signPayload({ secret, id, timestamp, body })}`;

const verificar = (cambios = {}) =>
  verifyWebhookSignature({ secret, id, timestamp, signature, body, now, ...cambios });

test('la firma se calcula como dice Recurrente: HMAC-SHA256 de "id.timestamp.cuerpo" en base64', () => {
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const esperado = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  assert.equal(signPayload({ secret, id, timestamp, body }), esperado);
});

test('acepta un aviso con la firma correcta (también si llega como Buffer o entre varias firmas)', () => {
  assert.equal(verificar(), true);
  assert.equal(verificar({ body: Buffer.from(body) }), true);
  assert.equal(verificar({ signature: `v1,firmaVieja= ${signature}` }), true);
});

test('rechaza un cuerpo modificado, otro secreto, otro id o una firma falsa', () => {
  assert.equal(verificar({ body: body.replace('ch_1', 'ch_2') }), false);
  assert.equal(verificar({ secret: `whsec_${Buffer.from('otra-clave').toString('base64')}` }), false);
  assert.equal(verificar({ id: 'msg_999' }), false);
  assert.equal(verificar({ signature: 'v1,AAAA' }), false);
  assert.equal(verificar({ signature: signature.replace('v1,', 'v2,') }), false);
});

test('rechaza avisos viejos o del futuro (más de 5 minutos) para que no se puedan reenviar', () => {
  assert.equal(verificar({ now: now + 6 * 60_000 }), false);
  assert.equal(verificar({ now: now - 6 * 60_000 }), false);
  assert.equal(verificar({ now: now + 4 * 60_000 }), true);
});

test('sin encabezados o sin secreto no pasa', () => {
  assert.equal(verificar({ signature: undefined }), false);
  assert.equal(verificar({ id: '' }), false);
  assert.equal(verificar({ timestamp: 'ayer' }), false);
  assert.equal(verificar({ secret: undefined }), false);
});
