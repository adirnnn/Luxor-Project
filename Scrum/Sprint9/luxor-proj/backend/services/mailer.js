// SFTWRKEY-428: envío de correos. No usa dependencias nuevas: si hay RESEND_API_KEY
// manda el correo con la API HTTP de Resend; si no, no envía nada y el llamador
// decide qué hacer (en desarrollo se registra el enlace en la consola).

const RESEND_URL = 'https://api.resend.com/emails';

export const isMailConfigured = (env = process.env) => Boolean(env.RESEND_API_KEY);

export async function sendPasswordResetEmail({ to, link, env = process.env, fetchImpl = fetch }) {
  if (!isMailConfigured(env)) return { sent: false };

  const response = await fetchImpl(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Habibi Parfums <onboarding@resend.dev>',
      to: [to],
      subject: 'Recupera tu contraseña',
      text:
        `Recibimos una solicitud para restablecer tu contraseña.\n\n` +
        `Usa este enlace (vence en 30 minutos):\n${link}\n\n` +
        `Si no fuiste tú, ignora este correo: tu contraseña no cambiará.`,
      html:
        `<p>Recibimos una solicitud para restablecer tu contraseña.</p>` +
        `<p><a href="${link}">Restablecer contraseña</a> (el enlace vence en 30 minutos).</p>` +
        `<p>Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p>`,
    }),
  });

  if (!response.ok) throw new Error(`El proveedor de correo respondió ${response.status}`);
  return { sent: true };
}
