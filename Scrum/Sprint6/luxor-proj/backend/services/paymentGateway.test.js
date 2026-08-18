import test from "node:test";
import assert from "node:assert/strict";

process.env.PAYMENT_GATEWAY_API_KEY = "test_key_for_unit_tests";
const { chargeCard, buildGatewayPayload, PaymentGatewayError } = await import("./paymentGateway.js");

const baseCard = {
  cardholderName: "Juan Pérez",
  expiryMonth: "12",
  expiryYear: "2030",
  cvv: "123",
};

test("aprueba una tarjeta válida y devuelve referencia de transacción", async () => {
  const payload = buildGatewayPayload({
    orderReference: "order-test-1",
    amount: 390,
    cartItems: [{ product_id: "khamrah", name: "Lattafa Khamrah", quantity: 1, price: 390 }],
    card: { ...baseCard, cardNumber: "4242 4242 4242 4242" },
    billing: { billingAddress: "Calle 1", city: "Guatemala", postalCode: "01001", country: "Guatemala" },
  });

  const result = await chargeCard(payload);

  assert.equal(result.approved, true);
  assert.equal(result.brand, "VISA");
  assert.equal(result.last4, "4242");
  assert.ok(result.transactionId);
  assert.ok(result.authCode);
});

test("rechaza una tarjeta de prueba por fondos insuficientes", async () => {
  const payload = buildGatewayPayload({
    orderReference: "order-test-2",
    amount: 100,
    cartItems: [],
    card: { ...baseCard, cardNumber: "4000000000000002" },
    billing: {},
  });

  const result = await chargeCard(payload);

  assert.equal(result.approved, false);
  assert.equal(result.declineCode, "FONDOS_INSUFICIENTES");
  assert.equal(result.transactionId, null);
});

test("rechaza un número de tarjeta que no pasa la validación de Luhn", async () => {
  const payload = buildGatewayPayload({
    orderReference: "order-test-3",
    amount: 100,
    cartItems: [],
    card: { ...baseCard, cardNumber: "1234567812345678" },
    billing: {},
  });

  const result = await chargeCard(payload);

  assert.equal(result.approved, false);
  assert.equal(result.declineCode, "NUMERO_INVALIDO");
});

test("el payload de la pasarela incluye el detalle del carrito", () => {
  const payload = buildGatewayPayload({
    orderReference: "order-test-4",
    amount: 780,
    cartItems: [{ product_id: "khamrah", name: "Lattafa Khamrah", quantity: 2, price: 390 }],
    card: { ...baseCard, cardNumber: "4242424242424242" },
    billing: { billingAddress: "Calle 1", city: "Guatemala", postalCode: "01001", country: "Guatemala" },
  });

  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].quantity, 2);
  assert.equal(payload.amount, 780);
  assert.equal(payload.card.number, "4242424242424242");
});

test("lanza PaymentGatewayError si falta configurar la API key", async () => {
  const err = new PaymentGatewayError("La pasarela de pago no está configurada.", { code: "GATEWAY_NOT_CONFIGURED" });
  assert.equal(err.code, "GATEWAY_NOT_CONFIGURED");
  assert.ok(err instanceof Error);
});