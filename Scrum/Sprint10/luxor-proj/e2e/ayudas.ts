// SFTWRKEY-456: pasos que se repiten en varios flujos.
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BACKEND_URL, PERFUME, TARJETA, correoUnico } from "./datos";

// ── por la API (solo para preparar datos, el flujo que se prueba va por el navegador) ──

export async function tokenDe(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${BACKEND_URL}/login`, { data: { email, password } });
  expect(res.status(), `login de ${email}`).toBe(200);
  return (await res.json()).token as string;
}

export async function crearCliente(request: APIRequestContext) {
  const cliente = { name: "Cliente Pruebas E2E", email: correoUnico("cliente"), password: "clave-segura-e2e" };
  const res = await request.post(`${BACKEND_URL}/register`, { data: cliente });
  expect(res.status(), "registro por la API").toBe(201);
  const { user } = await res.json();
  return { ...cliente, id: user.id as number, token: await tokenDe(request, cliente.email, cliente.password) };
}

// compra de 1 perfume con la tarjeta de prueba; devuelve el número de pedido
export async function comprarPorApi(request: APIRequestContext, cliente: { id: number; token: string }) {
  const auth = { Authorization: `Bearer ${cliente.token}` };
  const carrito = await request.post(`${BACKEND_URL}/cart/${cliente.id}`, {
    headers: auth,
    data: [{ product_id: PERFUME.id, quantity: 1 }],
  });
  expect(carrito.ok(), "llenar el carrito").toBeTruthy();
  const compra = await request.post(`${BACKEND_URL}/checkout/${cliente.id}`, {
    headers: auth,
    data: {
      cardholderName: TARJETA.titular, cardNumber: TARJETA.numero.replace(/\s/g, ""),
      expiryMonth: TARJETA.mes, expiryYear: TARJETA.anio, cvv: TARJETA.cvv,
      billingAddress: TARJETA.direccion, city: TARJETA.ciudad, postalCode: TARJETA.postal, country: "GT",
    },
  });
  expect(compra.status(), "pagar").toBe(201);
  return (await compra.json()).order.id as number;
}

// ── en el navegador ──

export async function iniciarSesion(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  // con sesión, el menú de la cuenta reemplaza al botón "Entrar"
  await expect(page.getByRole("button", { name: /menú de la cuenta/i })).toBeVisible();
}

export async function cerrarSesion(page: Page) {
  await page.getByRole("button", { name: /menú de la cuenta/i }).click();
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByRole("link", { name: /entrar/i }).first()).toBeVisible();
}

export async function agregarPerfumeAlCarrito(page: Page) {
  await page.goto(`/producto/${PERFUME.id}`);
  await expect(page.getByRole("heading", { name: PERFUME.name })).toBeVisible();
  await page.getByRole("button", { name: /agregar al carrito/i }).click();
  await page.goto("/cart");
  await expect(page.getByText(PERFUME.name).first()).toBeVisible();
}

export async function llenarTarjeta(page: Page) {
  await page.getByLabel("Nombre del titular").fill(TARJETA.titular);
  await page.getByLabel("Número de tarjeta").fill(TARJETA.numero);
  await page.getByLabel("Mes").selectOption(TARJETA.mes);
  await page.getByLabel("Año").selectOption(TARJETA.anio);
  await page.getByLabel("CVV").fill(TARJETA.cvv);
  await page.getByLabel("Dirección de facturación").fill(TARJETA.direccion);
  await page.getByLabel("Ciudad").fill(TARJETA.ciudad);
  await page.getByLabel("Código postal").fill(TARJETA.postal);
  await page.getByLabel("País").selectOption(TARJETA.pais);
}
