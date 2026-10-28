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

// ───────────────────────────────────────────────────────────────────────────
// SFTWRKEY-447 / SFTWRKEY-448: correos del pedido (confirmación y cambios de estado).
// Misma plantilla para todos; solo cambia el texto según el estado.
// ───────────────────────────────────────────────────────────────────────────

const ORDER_COPY = {
  pagado: {
    subject: (id) => `Confirmación de tu pedido #${id}`,
    title: 'Recibimos tu pedido',
    intro: 'Tu pago fue aprobado. Estamos preparando tu pedido.',
  },
  enviado: {
    subject: (id) => `Tu pedido #${id} va en camino`,
    title: 'Tu pedido fue enviado',
    intro: 'Tu pedido ya salió de nuestra tienda y va en camino.',
  },
  entregado: {
    subject: (id) => `Tu pedido #${id} fue entregado`,
    title: 'Tu pedido fue entregado',
    intro: 'Marcamos tu pedido como entregado. ¡Gracias por comprar con nosotros!',
  },
  cancelado: {
    subject: (id) => `Tu pedido #${id} fue cancelado`,
    title: 'Tu pedido fue cancelado',
    intro: 'Tu pedido fue cancelado. Si tienes dudas, escríbenos por WhatsApp.',
  },
};

export const ORDER_EMAIL_STATUSES = Object.keys(ORDER_COPY);

// el nombre del cliente y de los productos viene de la base: se escapa antes de ir al HTML
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (value) => `Q${Number(value).toFixed(2)}`;

// SFTWRKEY-449: texto de la entrega (dirección o local para recoger)
const deliveryText = (delivery) => {
  if (delivery?.method === 'recoger' && delivery.store) {
    return `Recoger en ${delivery.store.name}, ${delivery.store.address}`;
  }
  if (delivery?.method === 'envio' && delivery.address) {
    const a = delivery.address;
    return `Envío a ${a.billingAddress}, ${a.city}, ${a.postalCode}, ${a.country}`;
  }
  return null;
};

export function buildOrderEmail({ status, orderId, customerName, items = [], total, shipping = 0, delivery = null, discount = 0, couponCode = null, accountUrl }) {
  const copy = ORDER_COPY[status];
  if (!copy) throw new Error(`Estado sin correo: ${status}`);

  const hello = customerName ? `Hola ${customerName},` : 'Hola,';
  const lines = items.map((i) => `- ${i.name} x${i.quantity}: ${money(Number(i.unit_price) * i.quantity)}`);
  // SFTWRKEY-432: el descuento del cupón, para que los renglones sigan sumando el total
  const descuentoLabel = couponCode ? `Descuento (${couponCode})` : 'Descuento';
  if (discount > 0) lines.push(`- ${descuentoLabel}: -${money(discount)}`);
  const entrega = deliveryText(delivery);
  const envioLabel = delivery?.method === 'recoger' ? 'Recoger en tienda' : 'Envío';
  const envioMonto = shipping ? money(shipping) : 'Gratis';
  // el envío aparece aunque sea gratis, para que se entienda el total
  if (delivery) lines.push(`- ${envioLabel}: ${envioMonto}`);

  const text =
    `${hello}\n\n${copy.intro}\n\nPedido #${orderId}\n${lines.join('\n')}\n\nTotal: ${money(total)}\n\n` +
    (entrega ? `${entrega}\n\n` : '') +
    (accountUrl ? `Mira tu pedido en Mi cuenta: ${accountUrl}\n\n` : '') +
    `Perfumería Victoria`;

  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escapeHtml(i.name)} × ${i.quantity}</td>` +
        `<td style="padding:6px 0;text-align:right">${money(Number(i.unit_price) * i.quantity)}</td></tr>`
    )
    .join('') +
    (discount > 0
      ? `<tr><td style="padding:6px 0">${escapeHtml(descuentoLabel)}</td><td style="padding:6px 0;text-align:right">-${money(discount)}</td></tr>`
      : '') +
    (delivery
      ? `<tr><td style="padding:6px 0">${envioLabel}</td><td style="padding:6px 0;text-align:right">${envioMonto}</td></tr>`
      : '');

  const html =
    `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0f0d0a;color:#f3e9d2;padding:28px">` +
    `<h1 style="color:#d4af37;font-size:22px;margin:0 0 4px">Perfumería Victoria</h1>` +
    `<h2 style="font-size:18px;margin:0 0 16px">${copy.title}</h2>` +
    `<p>${escapeHtml(hello)}</p><p>${copy.intro}</p>` +
    `<p style="color:#d4af37">Pedido #${orderId}</p>` +
    `<table style="width:100%;border-collapse:collapse;color:#f3e9d2">${rows}` +
    `<tr><td style="padding-top:10px;border-top:1px solid #d4af37"><strong>Total</strong></td>` +
    `<td style="padding-top:10px;border-top:1px solid #d4af37;text-align:right"><strong>${money(total)}</strong></td></tr></table>` +
    (entrega ? `<p style="margin-top:16px">${escapeHtml(entrega)}</p>` : '') +
    (accountUrl
      ? `<p style="margin-top:20px"><a href="${escapeHtml(accountUrl)}" style="color:#d4af37">Ver mi pedido en Mi cuenta</a></p>`
      : '') +
    `</div>`;

  return { subject: copy.subject(orderId), text, html };
}

export async function sendOrderEmail({ to, env = process.env, fetchImpl = fetch, ...order }) {
  if (!isMailConfigured(env)) return { sent: false };
  const { subject, text, html } = buildOrderEmail(order);

  const response = await fetchImpl(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Perfumería Victoria <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) throw new Error(`El proveedor de correo respondió ${response.status}`);
  return { sent: true };
}
