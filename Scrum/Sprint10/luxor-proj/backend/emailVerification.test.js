// Verificación del correo al crear la cuenta y envío por Brevo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliverEmail, isMailConfigured, parseFrom, buildVerificationEmail } from './services/mailer.js';
import {
  needsVerification,
  startVerification,
  confirmVerification,
  hashVerificationToken,
} from './services/emailVerification.js';
import { createRegisterHandler } from './services/authHandlers.js';

const respuesta = (status = 201) => ({ ok: status < 400, status, json: async () => ({}) });

test('con BREVO_API_KEY el correo sale por Brevo con el remitente verificado', async () => {
  const llamadas = [];
  const fetchImpl = async (url, opts) => { llamadas.push({ url, opts }); return respuesta(); };
  const env = { BREVO_API_KEY: 'xkeysib-prueba', RESEND_API_KEY: 're_prueba', MAIL_FROM: 'Perfumería Victoria <tienda@gmail.com>' };

  await deliverEmail({ to: 'ana@correo.com', subject: 'Hola', text: 't', html: '<p>h</p>', env, fetchImpl });

  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(llamadas[0].opts.headers['api-key'], 'xkeysib-prueba');
  const body = JSON.parse(llamadas[0].opts.body);
  assert.deepEqual(body.sender, { name: 'Perfumería Victoria', email: 'tienda@gmail.com' });
  assert.deepEqual(body.to, [{ email: 'ana@correo.com' }]);
  assert.equal(body.htmlContent, '<p>h</p>');
  assert.equal(body.textContent, 't');
});

test('sin Brevo sigue usando Resend, y un error del proveedor se avisa', async () => {
  const llamadas = [];
  const fetchImpl = async (url) => { llamadas.push(url); return respuesta(403); };
  await assert.rejects(
    deliverEmail({ to: 'a@b.com', subject: 's', text: 't', html: 'h', env: { RESEND_API_KEY: 're_x' }, fetchImpl }),
    /respondió 403/
  );
  assert.deepEqual(llamadas, ['https://api.resend.com/emails']);
  assert.equal(isMailConfigured({}), false);
  assert.equal(isMailConfigured({ BREVO_API_KEY: 'x' }), true);
  assert.deepEqual(parseFrom('tienda@gmail.com'), { email: 'tienda@gmail.com' });
});

test('solo el registro desde la tienda pide verificación, y solo si se pueden mandar correos', () => {
  const conCorreo = { BREVO_API_KEY: 'x' };
  assert.equal(needsVerification({ requester: undefined, env: conCorreo }), true);
  assert.equal(needsVerification({ requester: { role: 'CLIENTE' }, env: conCorreo }), true);
  assert.equal(needsVerification({ requester: { role: 'ADMIN' }, env: conCorreo }), false, 'el admin crea cuentas confirmadas');
  assert.equal(needsVerification({ requester: undefined, env: {} }), false, 'sin proveedor nadie podría confirmar');
});

test('el enlace lleva el token, pero en la base solo queda su hash', async () => {
  const consultas = [];
  const pool = { query: async (sql, params) => { consultas.push({ sql, params }); return { rows: [], rowCount: 1 }; } };
  let enviado;
  const send = async (datos) => { enviado = datos; return { sent: true }; };

  await startVerification({ pool, user: { id: 5, name: 'Ana', email: 'ana@correo.com' }, env: { FRONTEND_URL: 'https://tienda.test/' }, send });

  const token = enviado.link.match(/token=([a-f0-9]{64})$/)?.[1];
  assert.ok(token, 'el enlace trae el token');
  assert.match(enviado.link, /^https:\/\/tienda\.test\/verificar-correo\?token=/);
  assert.equal(enviado.to, 'ana@correo.com');
  const insert = consultas.find((c) => /INSERT INTO email_verification_tokens/.test(c.sql));
  assert.equal(insert.params[1], hashVerificationToken(token));
  assert.ok(!JSON.stringify(consultas).includes(token), 'el token no se guarda tal cual');
  assert.ok(consultas.some((c) => /UPDATE email_verification_tokens SET used_at = NOW\(\)/.test(c.sql)), 'los enlaces anteriores dejan de servir');
});

test('un token con formato inválido ni siquiera llega a la base', async () => {
  const pool = { query: async () => { throw new Error('no debería consultar'); } };
  assert.equal(await confirmVerification({ pool, token: 'abc' }), null);
});

function fakePool() {
  const consultas = [];
  return {
    consultas,
    query: async (sql, params) => {
      consultas.push({ sql, params });
      if (/INSERT INTO users/.test(sql)) return { rows: [{ id: 9, name: params[0], email: params[1] }] };
      return { rows: [], rowCount: 1 };
    },
  };
}
const bcrypt = { hash: async () => 'hash' };
const pedir = (body) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return { req: { body }, res };
};
const datos = { name: 'Ana', email: 'ana@correo.com', password: 'clave-segura-123' };

test('al registrarse desde la tienda la cuenta queda sin confirmar y se manda el correo', async () => {
  const pool = fakePool();
  let enviadoA;
  const handler = createRegisterHandler({
    pool, bcrypt, saltRounds: 1,
    verification: { needs: () => true, start: async (user) => { enviadoA = user.email; return { sent: true }; } },
  });
  const { req, res } = pedir(datos);
  await handler(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.emailVerified, false);
  assert.equal(res.body.verificationSent, true);
  assert.equal(enviadoA, 'ana@correo.com');
  assert.ok(pool.consultas.some((c) => /UPDATE users SET email_verified = FALSE WHERE id = \$1/.test(c.sql) && c.params[0] === 9));
});

test('si el correo falla la cuenta se crea igual (se puede pedir otro enlace)', async () => {
  const handler = createRegisterHandler({
    pool: fakePool(), bcrypt, saltRounds: 1,
    verification: { needs: () => true, start: async () => { throw new Error('El proveedor de correo respondió 403'); } },
  });
  const { req, res } = pedir(datos);
  await handler(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.verificationSent, false);
  assert.equal(res.body.user.emailVerified, false);
});

test('el correo de verificación lleva el enlace y escapa el nombre', () => {
  const { subject, html, text } = buildVerificationEmail({ name: '<b>Ana</b>', link: 'https://tienda.test/verificar-correo?token=abc' });
  assert.match(subject, /Confirma tu correo/);
  assert.ok(html.includes('&lt;b&gt;Ana&lt;/b&gt;'));
  assert.ok(text.includes('https://tienda.test/verificar-correo?token=abc'));
});

test('el error del proveedor dice el motivo para saber qué arreglar', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ name: 'validation_error', message: 'The perfumesvictoria.shop domain is not verified.' }),
  });
  await assert.rejects(
    deliverEmail({ to: 'a@b.com', subject: 's', text: 't', html: 'h', env: { RESEND_API_KEY: 're_x' }, fetchImpl }),
    /403: The perfumesvictoria\.shop domain is not verified\./
  );
});
