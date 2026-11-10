// SFTWRKEY-428: envío de correos. No usa dependencias nuevas: manda el correo por la API HTTP de
// Brevo (si hay BREVO_API_KEY) o de Resend (si hay RESEND_API_KEY). Sin ninguna, no envía nada y el
// llamador decide qué hacer (en desarrollo se registra el enlace en la consola).
// Brevo va primero porque su plan gratis manda a cualquier correo con solo verificar el remitente;
// Resend sin dominio propio solo entrega al dueño de la cuenta (responde 403 a los demás).
// Render (plan gratis) bloquea SMTP, por eso los dos se usan por HTTP.

const RESEND_URL = 'https://api.resend.com/emails';
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const REMITENTE = 'Perfumería Victoria <onboarding@resend.dev>';

export const isMailConfigured = (env = process.env) => Boolean(env.BREVO_API_KEY || env.RESEND_API_KEY);

// "Perfumería Victoria <tienda@gmail.com>" → { name, email }
export const parseFrom = (from) => {
  const m = String(from).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, '') || undefined, email: m[2].trim() } : { email: String(from).trim() };
};

// un solo lugar que habla con el proveedor
export async function deliverEmail({ to, subject, text, html, env = process.env, fetchImpl = fetch }) {
  if (env.BREVO_API_KEY) {
    const response = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: parseFrom(env.MAIL_FROM || REMITENTE),
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });
    if (!response.ok) throw new Error(`El proveedor de correo respondió ${response.status}`);
    return { sent: true };
  }

  const response = await fetchImpl(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM || REMITENTE, to: [to], subject, text, html }),
  });
  if (!response.ok) throw new Error(`El proveedor de correo respondió ${response.status}`);
  return { sent: true };
}

export async function sendPasswordResetEmail({ to, link, env = process.env, fetchImpl = fetch }) {
  if (!isMailConfigured(env)) return { sent: false };
  return deliverEmail({
    to,
    env,
    fetchImpl,
    subject: 'Recupera tu contraseña',
    text:
      `Recibimos una solicitud para restablecer tu contraseña.

` +
      `Usa este enlace (vence en 30 minutos):
${link}

` +
      `Si no fuiste tú, ignora este correo: tu contraseña no cambiará.`,
    html:
      `<p>Recibimos una solicitud para restablecer tu contraseña.</p>` +
      `<p><a href="${link}">Restablecer contraseña</a> (el enlace vence en 30 minutos).</p>` +
      `<p>Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p>`,
  });
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

// ───────────────────────────────────────────────────────────────────────────
// SFTWRKEY-450: aviso de que un perfume agotado volvió a tener stock.
// Lleva un enlace a la ficha y otro para no recibir más avisos.
// ───────────────────────────────────────────────────────────────────────────

export function buildRestockEmail({ productName, price, productUrl, unsubscribeUrl }) {
  const subject = `¡Volvió ${productName}!`;
  const precio = price !== null && price !== undefined ? money(price) : null;

  const text =
    `Hola,\n\n${productName} ya está disponible otra vez en Perfumería Victoria` +
    (precio ? ` (${precio})` : '') +
    `.\n\nVer el perfume: ${productUrl}\n\n` +
    `Te escribimos porque pediste este aviso. Es el único correo que recibirás por este perfume.\n` +
    `Si no quieres más avisos: ${unsubscribeUrl}\n\nPerfumería Victoria`;

  const html =
    `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0f0d0a;color:#f3e9d2;padding:28px">` +
    `<h1 style="color:#d4af37;font-size:22px;margin:0 0 4px">Perfumería Victoria</h1>` +
    `<h2 style="font-size:18px;margin:0 0 16px">¡${escapeHtml(productName)} volvió!</h2>` +
    `<p>Hola,</p><p>El perfume que esperabas ya está disponible otra vez` +
    (precio ? ` por <strong>${precio}</strong>` : '') +
    `.</p>` +
    `<p style="margin:24px 0"><a href="${escapeHtml(productUrl)}" style="background:#d4af37;color:#0f0d0a;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Ver el perfume</a></p>` +
    `<p style="font-size:12px;color:#b9ad95">Te escribimos porque pediste este aviso. Es el único correo que recibirás por este perfume. ` +
    `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#d4af37">No quiero recibir más avisos</a>.</p>` +
    `</div>`;

  return { subject, text, html };
}

export async function sendRestockEmail({ to, env = process.env, fetchImpl = fetch, ...product }) {
  if (!isMailConfigured(env)) return { sent: false };
  return deliverEmail({ to, env, fetchImpl, ...buildRestockEmail(product) });
}

export async function sendOrderEmail({ to, env = process.env, fetchImpl = fetch, ...order }) {
  if (!isMailConfigured(env)) return { sent: false };
  return deliverEmail({ to, env, fetchImpl, ...buildOrderEmail(order) });
}

// ───────────────────────────────────────────────────────────────────────────
// Verificación del correo al crear la cuenta desde la tienda.
// ───────────────────────────────────────────────────────────────────────────

export function buildVerificationEmail({ name, link }) {
  const hello = name ? `Hola ${name},` : 'Hola,';
  const text =
    `${hello}

Gracias por crear tu cuenta en Perfumería Victoria.

` +
    `Confirma tu correo con este enlace (vence en 24 horas):
${link}

` +
    `Mientras no lo confirmes puedes ver la tienda y llenar tu carrito, pero no pagar con tu cuenta.
` +
    `Si no creaste esta cuenta, ignora este correo.

Perfumería Victoria`;
  const html =
    `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0f0d0a;color:#f3e9d2;padding:28px">` +
    `<h1 style="color:#d4af37;font-size:22px;margin:0 0 4px">Perfumería Victoria</h1>` +
    `<h2 style="font-size:18px;margin:0 0 16px">Confirma tu correo</h2>` +
    `<p>${escapeHtml(hello)}</p><p>Gracias por crear tu cuenta. Confirma tu correo para poder comprar con ella.</p>` +
    `<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#d4af37;color:#0f0d0a;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Confirmar mi correo</a></p>` +
    `<p style="font-size:12px;color:#b9ad95">El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este correo.</p>` +
    `</div>`;
  return { subject: 'Confirma tu correo en Perfumería Victoria', text, html };
}

export async function sendVerificationEmail({ to, name, link, env = process.env, fetchImpl = fetch }) {
  if (!isMailConfigured(env)) return { sent: false };
  return deliverEmail({ to, env, fetchImpl, ...buildVerificationEmail({ name, link }) });
}
