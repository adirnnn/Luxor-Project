// SFTWRKEY-456 · Flujo 2: compra completa de un cliente, pagando en Recurrente (simulado).
import { test, expect } from "@playwright/test";
import { PERFUME } from "./datos";
import { agregarPerfumeAlCarrito, crearCliente, enRecurrente, iniciarSesion, llenarDireccion } from "./ayudas";

test("un cliente agrega un perfume, paga en Recurrente y ve el pedido en Mi cuenta", async ({ page, request }) => {
  const cliente = await crearCliente(request);
  await iniciarSesion(page, cliente.email, cliente.password);

  // carrito
  await agregarPerfumeAlCarrito(page);
  await page.getByRole("button", { name: "Ir a Pagar" }).click();
  await expect(page).toHaveURL(/\/pago$/);

  // dirección en la tienda y pago en la página de Recurrente
  await llenarDireccion(page);
  await page.getByRole("button", { name: /continuar al pago seguro/i }).click();
  await enRecurrente(page, "Pagar");

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

test("si la tarjeta se rechaza y el cliente se sale, no hay pedido y el carrito sigue igual", async ({ page, request }) => {
  const cliente = await crearCliente(request);
  await iniciarSesion(page, cliente.email, cliente.password);
  await agregarPerfumeAlCarrito(page);
  await page.getByRole("button", { name: "Ir a Pagar" }).click();

  await llenarDireccion(page);
  await page.getByRole("button", { name: /continuar al pago seguro/i }).click();
  await enRecurrente(page, "Rechazar tarjeta");
  await expect(page.getByRole("alert")).toContainText("Fondos insuficientes");
  await page.getByRole("button", { name: "Salir sin pagar" }).click();

  await expect(page).toHaveURL(/\/pago\/cancelado\?ref=/);
  await expect(page.getByText("No se completó el pago")).toBeVisible();
  await expect(page.getByText(/Motivo: Fondos insuficientes/)).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByText(PERFUME.name).first()).toBeVisible();
  await page.goto("/mi-cuenta");
  await expect(page.getByRole("button", { name: /Pedido #\d+/ })).toHaveCount(0);
});
