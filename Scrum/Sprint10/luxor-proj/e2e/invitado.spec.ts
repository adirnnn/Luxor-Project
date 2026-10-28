// SFTWRKEY-456 · Flujo 3: compra de un invitado (sin cuenta).
import { test, expect } from "@playwright/test";
import { PERFUME, correoUnico } from "./datos";
import { agregarPerfumeAlCarrito, enRecurrente, llenarDireccion } from "./ayudas";

test("un visitante sin cuenta compra como invitado y recibe su número de pedido", async ({ page }) => {
  await agregarPerfumeAlCarrito(page);
  await page.getByRole("link", { name: "Comprar como invitado" }).click();
  await expect(page).toHaveURL(/\/pago-invitado$/);

  // el resumen muestra el perfume con el precio de la base
  await expect(page.getByText(new RegExp(`${PERFUME.name} × 1`))).toBeVisible();
  // SFTWRKEY-449: Q35 de envío por debajo de Q500
  await expect(page.getByText("Envío: Q35.00")).toBeVisible();
  await expect(page.getByText(`Total: Q${(PERFUME.price + 35).toFixed(2)}`)).toBeVisible();

  await page.getByLabel("Nombre completo").fill("Invitado Pruebas");
  await page.getByLabel("Correo electrónico").fill(correoUnico("invitado"));
  await llenarDireccion(page);
  await page.getByRole("button", { name: /continuar al pago seguro/i }).click();
  await enRecurrente(page, "Pagar");

  // de vuelta en la tienda, el comprobante con el número de pedido
  await expect(page).toHaveURL(/\/pago\/resultado\?ref=/);
  await expect(page.getByText("¡Gracias por tu compra!")).toBeVisible();
  await expect(page.getByText(/^#\d+$/)).toBeVisible();
  await expect(page.getByText(/VISA •••• 4242/)).toBeVisible();

  // el carrito quedó vacío
  await page.goto("/cart");
  await expect(page.getByText(PERFUME.name)).toHaveCount(0);
});

test("un invitado elige recoger en tienda: no paga envío y el comprobante dice dónde recoger", async ({ page }) => {
  await agregarPerfumeAlCarrito(page);
  await page.getByRole("link", { name: "Comprar como invitado" }).click();

  await page.getByLabel("Nombre completo").fill("Invitado Recoge");
  await page.getByLabel("Correo electrónico").fill(correoUnico("recoge"));
  await page.getByRole("radio", { name: /recoger en tienda/i }).click();
  await expect(page.getByText("Recoger en tienda: Gratis")).toBeVisible();
  await expect(page.getByText(`Total: Q${PERFUME.price.toFixed(2)}`)).toBeVisible();
  await page.getByLabel("Local").selectOption("luxor");
  await page.getByRole("button", { name: /continuar al pago seguro/i }).click();
  await enRecurrente(page, "Pagar");

  await expect(page.getByText("¡Gracias por tu compra!")).toBeVisible();
  await expect(page.getByText(/Recoger en Joyería Luxor/)).toBeVisible();
});
