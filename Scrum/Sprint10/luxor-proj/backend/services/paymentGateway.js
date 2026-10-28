// SFTWRKEY-445: pasarela de pago real con Recurrente (https://docs.recurrente.com).
// El cliente paga en la página de Recurrente: el número de tarjeta nunca llega a este servidor.
// Aquí solo se crea el checkout con los productos y el total que calculó el backend, y después
// se le pregunta a Recurrente si quedó pagado. La llave va en RECURRENTE_SECRET_KEY (Render):
// sk_test_... para el sandbox y sk_live_... para cobrar de verdad.
const API_URL = 'https://app.recurrente.com/api';
// Recurrente acepta de 1 a 9 unidades por renglón
const MAX_QTY_PER_LINE = 9;

export class PaymentGatewayError extends Error {
  constructor(message, { cause, code, status } = {}) {
    super(message);
    this.name = 'PaymentGatewayError';
    this.code = code ?? 'GATEWAY_ERROR';
    if (status) this.status = status;
    if (cause) this.cause = cause;
  }
}

export const isGatewayConfigured = (env = process.env) => Boolean(env.RECURRENTE_SECRET_KEY);

// Renglones para Recurrente: más de 9 unidades del mismo perfume se parten en varios renglones
export function buildCheckoutItems(items) {
  const lines = [];
  for (const item of items) {
    let left = item.quantity;
    while (left > 0) {
      const quantity = Math.min(left, MAX_QTY_PER_LINE);
      lines.push({
        name: item.name,
        amount_in_cents: Math.round(Number(item.price) * 100),
        currency: 'GTQ',
        quantity,
      });
      left -= quantity;
    }
  }
  return lines;
}

// Las pruebas de extremo a extremo apuntan a un Recurrente simulado (e2e/recurrente-simulado.mjs).
// En producción se ignora: el dinero siempre va a la API real.
const apiUrl = (env) => (env.NODE_ENV !== 'production' && env.RECURRENTE_API_URL) || API_URL;

async function call(path, { method = 'GET', body, env = process.env, fetchImpl = fetch } = {}) {
  if (!isGatewayConfigured(env)) {
    throw new PaymentGatewayError('La pasarela de pago no está configurada (falta RECURRENTE_SECRET_KEY).', {
      code: 'GATEWAY_NOT_CONFIGURED',
    });
  }

  let response;
  try {
    response = await fetchImpl(`${apiUrl(env)}${path}`, {
      method,
      headers: { 'X-SECRET-KEY': env.RECURRENTE_SECRET_KEY, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new PaymentGatewayError('No se pudo contactar a Recurrente.', { cause: err });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // el mensaje de Recurrente no trae datos de tarjeta; se guarda para el log del servidor
    throw new PaymentGatewayError(`Recurrente respondió ${response.status}: ${data?.message ?? 'sin detalle'}`, {
      status: response.status,
    });
  }
  return data;
}

// Normaliza el checkout de Recurrente a lo que usa la tienda. Solo se toman la marca y los
// últimos 4 dígitos de la tarjeta; Recurrente nunca devuelve el número completo.
export function toCheckoutResult(data) {
  const card = data?.payment_method?.card ?? data?.payment_method ?? {};
  const intent = data?.latest_intent ?? {};
  return {
    id: data?.id ?? null,
    url: data?.checkout_url ?? null,
    // unpaid | payment_in_progress | paid | expired
    status: data?.status ?? 'unpaid',
    paymentId: data?.payment?.id ?? null,
    brand: card.network ? String(card.network).toUpperCase().slice(0, 20) : null,
    last4: card.last4 ? String(card.last4).slice(-4) : null,
    failureReason: intent.details?.failure_reason ?? intent.failure_reason ?? null,
  };
}

// Las funciones van en un objeto para que las pruebas automáticas puedan reemplazarlas
// por un proveedor simulado sin llamar a Recurrente.
export const gateway = {
  async createCheckout({ reference, items, successUrl, cancelUrl, expiresAt }, opts) {
    const data = await call('/checkouts', {
      ...opts,
      method: 'POST',
      body: {
        items: buildCheckoutItems(items),
        success_url: successUrl,
        cancel_url: cancelUrl,
        expires_at: expiresAt.toISOString(),
        metadata: { referencia: reference },
      },
    });
    const result = toCheckoutResult(data);
    if (!result.id || !result.url) {
      throw new PaymentGatewayError('Recurrente no devolvió el enlace de pago.');
    }
    return result;
  },

  async getCheckout(id, opts) {
    return toCheckoutResult(await call(`/checkouts/${encodeURIComponent(id)}`, opts));
  },
};
