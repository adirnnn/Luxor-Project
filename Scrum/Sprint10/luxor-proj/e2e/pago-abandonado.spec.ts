// Si el cliente abre el pago y vuelve a la tienda con el botón "atrás" (sin "Salir sin pagar"),
// el stock apartado regresa enseguida: antes se quedaba apartado 30 minutos y el perfume se veía agotado.
import { test, expect, type APIRequestContext } from "@playwright/test";
import { BACKEND_URL, PERFUME } from "./datos";
import { agregarPerfumeAlCarrito, crearCliente, iniciarSesion, llenarDireccion } from "./ayudas";

const stock = async (request: APIRequestContext) =>
  Number((await (await request.get(`${BACKEND_URL}/products/${PERFUME.id}`)).json()).stock);

test("al volver atrás desde la página de pago, el stock apartado regresa", async ({ page, request }) => {
  const cliente = await crearCliente(request);
  await iniciarSesion(page, cliente.email, cliente.password);
  await agregarPerfumeAlCarrito(page);
  const antes = await stock(request);

  await page.goto("/pago");
  await llenarDireccion(page);
  await page.getByRole("button", { name: /continuar al pago seguro/i }).click();
  await expect(page.getByRole("heading", { name: "Recurrente (simulado)" })).toBeVisible();
  // al abrir el pago se aparta 1 unidad
  expect(await stock(request)).toBe(antes - 1);

  // el cliente se arrepiente y usa el botón atrás del navegador
  await page.goBack();
  await expect(page).toHaveURL(/\/pago$/);
  await expect.poll(() => stock(request), { timeout: 10_000 }).toBe(antes);

  // y puede volver a pagar normalmente
  await page.goto("/cart");
  await expect(page.getByText(PERFUME.name).first()).toBeVisible();
});
