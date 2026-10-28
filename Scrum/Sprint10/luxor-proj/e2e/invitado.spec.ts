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
  await expect(page.getByText(`Total: Q${PERFUME.price.toFixed(2)}`)).toBeVisible();

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
