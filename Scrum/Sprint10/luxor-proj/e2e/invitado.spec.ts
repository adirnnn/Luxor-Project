// SFTWRKEY-456 · Flujo 3: compra de un invitado (sin cuenta).
import { test, expect } from "@playwright/test";
import { PERFUME, correoUnico } from "./datos";
import { agregarPerfumeAlCarrito, llenarTarjeta } from "./ayudas";

test("un visitante sin cuenta compra como invitado y recibe su número de pedido", async ({ page }) => {
  await agregarPerfumeAlCarrito(page);
  await page.getByRole("link", { name: "Comprar como invitado" }).click();
  await expect(page).toHaveURL(/\/pago-invitado$/);

  // el resumen muestra el perfume con el precio de la base
  await expect(page.getByText(new RegExp(`${PERFUME.name} × 1`))).toBeVisible();
  await expect(page.getByText(`Total: Q${PERFUME.price.toFixed(2)}`)).toBeVisible();

  await page.getByLabel("Nombre completo").fill("Invitado Pruebas");
  await page.getByLabel("Correo electrónico").fill(correoUnico("invitado"));
  await llenarTarjeta(page);
  await page.getByRole("button", { name: /confirmar y pagar/i }).click();

  await expect(page.getByRole("heading", { name: "Compra registrada" })).toBeVisible();
  await expect(page.getByText(/Pedido #\d+/)).toBeVisible();

  // el carrito quedó vacío
  await page.goto("/cart");
  await expect(page.getByText(PERFUME.name)).toHaveCount(0);
});
