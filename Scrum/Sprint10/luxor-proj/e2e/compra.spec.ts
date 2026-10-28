// SFTWRKEY-456 · Flujo 2: compra completa de un cliente con la tarjeta de prueba.
import { test, expect } from "@playwright/test";
import { PERFUME } from "./datos";
import { agregarPerfumeAlCarrito, crearCliente, iniciarSesion, llenarTarjeta } from "./ayudas";

test("un cliente agrega un perfume, paga con tarjeta y ve el pedido en Mi cuenta", async ({ page, request }) => {
  const cliente = await crearCliente(request);
  await iniciarSesion(page, cliente.email, cliente.password);

  // carrito
  await agregarPerfumeAlCarrito(page);
  await page.getByRole("button", { name: "Ir a Pagar" }).click();
  await expect(page).toHaveURL(/\/pago$/);

  // pago con la tarjeta de prueba
  await llenarTarjeta(page);
  await page.getByRole("button", { name: /confirmar y pagar/i }).click();

  // confirmación con el número de pedido
  await expect(page).toHaveURL(/\/compra-confirmada\/\d+$/);
  const numero = page.url().split("/").pop();
  await expect(page.getByText(`#${numero}`).first()).toBeVisible();
  await expect(page.getByText(PERFUME.name).first()).toBeVisible();

  // el carrito quedó vacío
  await page.goto("/cart");
  await expect(page.getByText(PERFUME.name)).toHaveCount(0);

  // el pedido aparece en Mi cuenta como pagado
  await page.goto("/mi-cuenta");
  const pedido = page.getByRole("button", { name: new RegExp(`Pedido #${numero}\\b`) });
  await expect(pedido).toBeVisible();
  await expect(pedido).toContainText("Pagado");
});
