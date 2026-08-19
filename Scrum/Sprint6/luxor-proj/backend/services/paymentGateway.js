// SFTWRKEY-295/297: cliente de la pasarela de pago.
// Simula la integración con una pasarela real (tipo Stripe/Recurrente) usando
// tarjetas de prueba conocidas, para poder desarrollar y probar todo el flujo
// de pagos sin depender de credenciales reales.
// Depende de PAYMENT_GATEWAY_API_KEY definida en backend/.env
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.PAYMENT_GATEWAY_API_KEY;
const SIMULATED_LATENCY_MS = Number(process.env.PAYMENT_GATEWAY_LATENCY_MS ?? 400);

export class PaymentGatewayError extends Error {
  constructor(message, { cause, code } = {}) {
    super(message);
    this.name = 'PaymentGatewayError';
    this.code = code ?? 'GATEWAY_ERROR';
    if (cause) this.cause = cause;
  }
}

// tarjetas de prueba
// para poder probar cada camino (fondos insuficientes, vencida, cvv, etc.) sin un banco real.
const TEST_DECLINE_CARDS = {
  '4000000000000002': 'FONDOS_INSUFICIENTES',
  '4000000000009995': 'FONDOS_INSUFICIENTES',
  '4000000000000069': 'TARJETA_VENCIDA',
  '4000000000000127': 'CVV_INCORRECTO',
  '4000000000000119': 'TARJETA_BLOQUEADA',
};

const DECLINE_MESSAGES = {
  FONDOS_INSUFICIENTES: 'La tarjeta no tiene fondos suficientes para completar la compra.',
  TARJETA_VENCIDA: 'La tarjeta fue rechazada por la pasarela: está vencida.',
  CVV_INCORRECTO: 'El código de seguridad (CVV) no coincide con el registrado por el banco.',
  TARJETA_BLOQUEADA: 'La tarjeta fue rechazada: el banco emisor la reporta bloqueada.',
  NUMERO_INVALIDO: 'El número de tarjeta ingresado no es válido.',
};

// algoritmo de Luhn: validación de números de tarjeta antes de "enviarlos" a la pasarela
function isValidLuhn(digits) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function detectBrand(digits) {
  if (/^4/.test(digits)) return 'VISA';
  if (/^5[1-5]/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  return 'DESCONOCIDA';
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Arma el payload que se envía a la pasarela: referencia de la orden,
 * monto total y el detalle del carrito (para conciliación en el dashboard de la pasarela).
 */
export function buildGatewayPayload({ orderReference, amount, currency = 'GTQ', cartItems, card, billing }) {
  const cardDigits = (card?.cardNumber || '').replace(/\D/g, '');
  return {
    orderReference,
    amount: Number(amount.toFixed(2)),
    currency,
    items: cartItems.map((item) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.price),
    })),
    card: {
      number: cardDigits,
      holder: card?.cardholderName,
      expiryMonth: card?.expiryMonth,
      expiryYear: card?.expiryYear,
      cvv: card?.cvv,
    },
    billing: {
      address: billing?.billingAddress,
      city: billing?.city,
      postalCode: billing?.postalCode,
      country: billing?.country,
    },
  };
}

/**
 * Simula el cobro contra la pasarela y devuelve una respuesta con la misma forma
 * que tendría una pasarela real (aprobado/rechazado + referencia de transacción).
 */
export async function chargeCard(payload) {
  if (!API_KEY) {
    throw new PaymentGatewayError(
      'La pasarela de pago no está configurada (falta PAYMENT_GATEWAY_API_KEY).',
      { code: 'GATEWAY_NOT_CONFIGURED' }
    );
  }

  // simula la latencia de red de una pasarela real
  await wait(SIMULATED_LATENCY_MS);

  const digits = payload.card.number;
  const brand = detectBrand(digits);
  const last4 = digits.slice(-4);

  if (digits.length !== 16 || !isValidLuhn(digits)) {
    return {
      approved: false,
      declineCode: 'NUMERO_INVALIDO',
      declineMessage: DECLINE_MESSAGES.NUMERO_INVALIDO,
      brand,
      last4,
      transactionId: null,
      authCode: null,
    };
  }

  if (TEST_DECLINE_CARDS[digits]) {
    const declineCode = TEST_DECLINE_CARDS[digits];
    return {
      approved: false,
      declineCode,
      declineMessage: DECLINE_MESSAGES[declineCode],
      brand,
      last4,
      transactionId: null,
      authCode: null,
    };
  }

  const transactionId = `gw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const authCode = Math.random().toString(36).slice(2, 8).toUpperCase();

  return {
    approved: true,
    declineCode: null,
    declineMessage: null,
    brand,
    last4,
    transactionId,
    authCode,
  };
}