// SFTWRKEY-456: pasos que se repiten en varios flujos.
import { readFileSync } from "node:fs";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { ARCHIVO_TOKEN_ADMIN, BACKEND_URL, PERFUME, DIRECCION, correoUnico } from "./datos";

// ── por la API (solo para preparar datos, el flujo que se prueba va por el navegador) ──

// SFTWRKEY-451: el token solo viene en la cookie de sesión (httpOnly)
export async function tokenDe(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${BACKEND_URL}/login`, { data: { email, password } });
  expect(res.status(), `login de ${email}`).toBe(200);
  const cookie = res.headersArray().find((h) => h.name.toLowerCase() === "set-cookie")?.value ?? "";
  return decodeURIComponent(cookie.match(/luxor_sesion=([^;]+)/)?.[1] ?? "");
}

// token del admin que guardó el paso de preparación
export const tokenAdmin = () => readFileSync(ARCHIVO_TOKEN_ADMIN, "utf8");

export async function crearCliente(request: APIRequestContext) {
  const cliente = { name: "Cliente Pruebas E2E", email: correoUnico("cliente"), password: "clave-segura-e2e" };
  const res = await request.post(`${BACKEND_URL}/register`, { data: cliente });
  expect(res.status(), "registro por la API").toBe(201);
  const { user } = await res.json();
  return { ...cliente, id: user.id as number };
}

// el admin compra 1 perfume a nombre del cliente, pagado en el Recurrente simulado; devuelve el
// número de pedido (con el token del admin, para no iniciar sesión de más: SFTWRKEY-451)
export async function comprarPorApi(request: APIRequestContext, cliente: { id: number }) {
  const auth = { Authorization: `Bearer ${tokenAdmin()}` };
  const carrito = await request.post(`${BACKEND_URL}/cart/${cliente.id}`, {
    headers: auth,
    data: [{ product_id: PERFUME.id, quantity: 1 }],
  });
  expect(carrito.ok(), "llenar el carrito").toBeTruthy();
  const abierto = await request.post(`${BACKEND_URL}/checkout/${cliente.id}`, {
    headers: auth,
    data: { billingAddress: DIRECCION.direccion, city: DIRECCION.ciudad, postalCode: DIRECCION.postal, country: DIRECCION.pais },
  });
  expect(abierto.status(), "abrir el pago").toBe(201);
  const { checkoutUrl, reference } = await abierto.json();

  // el cliente paga en la página de Recurrente (simulado)
  const pago = await request.post(`${checkoutUrl}/pagar`, { maxRedirects: 0 });
  expect(pago.status(), "pagar en Recurrente").toBe(303);

  const confirmado = await request.post(`${BACKEND_URL}/checkout/confirm`, { data: { reference } });
  expect(confirmado.ok(), "confirmar el pago").toBeTruthy();
  return (await confirmado.json()).order.id as number;
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

// SFTWRKEY-445: la tienda solo pide la dirección; la tarjeta va en la página de Recurrente
export async function llenarDireccion(page: Page) {
  await page.getByLabel("Dirección de envío").fill(DIRECCION.direccion);
  await page.getByLabel("Ciudad").fill(DIRECCION.ciudad);
  await page.getByLabel("Código postal").fill(DIRECCION.postal);
  await page.getByLabel("País").selectOption(DIRECCION.pais);
}

// en la página de Recurrente (simulado): "Pagar", "Rechazar tarjeta" o "Salir sin pagar"
export async function enRecurrente(page: Page, boton: "Pagar" | "Rechazar tarjeta" | "Salir sin pagar") {
  await expect(page.getByRole("heading", { name: "Recurrente (simulado)" })).toBeVisible();
  await page.getByRole("button", { name: boton, exact: true }).click();
}
