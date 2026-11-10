// Consola del admin: filtrar agotados, reponer el stock desde la tabla, modo claro/oscuro, y que un
// cliente borre su propia cuenta desde Mi cuenta (pero nunca un admin).
import { test, expect } from "@playwright/test";
import { ADMIN, BACKEND_URL, PERFUME } from "./datos";
import { crearCliente, iniciarSesion, tokenAdmin } from "./ayudas";

test("el admin filtra los agotados y repone el stock desde la tabla", async ({ page, request }) => {
  // el perfume de las pruebas queda agotado
  const auth = { Authorization: `Bearer ${tokenAdmin()}` };
  const original = (await (await request.get(`${BACKEND_URL}/products/${PERFUME.id}`)).json()).stock as number;
  expect((await request.patch(`${BACKEND_URL}/admin/products/${PERFUME.id}/stock`, { headers: auth, data: { stock: 0 } })).ok()).toBeTruthy();

  await iniciarSesion(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await page.getByRole("link", { name: /Agotados/ }).click();
  await expect(page).toHaveURL(/\/admin\/inventario\?stock=agotado$/);
  await expect(page.getByRole("tab", { name: /Agotados/ })).toHaveAttribute("aria-selected", "true");

  const stock = page.getByLabel(`Stock de ${PERFUME.name}`).first();
  await expect(stock).toHaveValue("0");
  await stock.fill(String(original));
  await stock.press("Enter");
  await expect(page.getByText(/volvió a tener stock/)).toBeVisible();
  const producto = await (await request.get(`${BACKEND_URL}/products/${PERFUME.id}`)).json();
  expect(producto.stock).toBe(original);

  // el tema se cambia y se recuerda
  const consola = page.locator(".admin-console");
  const antes = await consola.getAttribute("data-theme");
  await page.getByRole("button", { name: /Cambiar a modo/ }).click();
  await expect(consola).not.toHaveAttribute("data-theme", antes ?? "");
  await page.reload();
  await expect(page.locator(".admin-console")).not.toHaveAttribute("data-theme", antes ?? "");
});

test.describe("borrar la cuenta", () => {
  test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.22" } });

  test("el cliente borra su cuenta desde Mi cuenta con su contraseña", async ({ page, request }) => {
    const cliente = await crearCliente(request);
    await iniciarSesion(page, cliente.email, cliente.password);
    await page.goto("/mi-cuenta");
    await page.getByRole("button", { name: "Borrar mi cuenta" }).click();
    await page.getByLabel(/Tu contraseña/).fill("no-es-la-clave");
    await page.getByRole("button", { name: "Sí, borrar mi cuenta" }).click();
    await expect(page.getByText("La contraseña no es correcta.")).toBeVisible();

    await page.getByLabel(/Tu contraseña/).fill(cliente.password);
    await page.getByRole("button", { name: "Sí, borrar mi cuenta" }).click();
    await expect(page.getByText("Tu cuenta se borró.")).toBeVisible();
    await expect(page.getByRole("link", { name: /entrar/i }).first()).toBeVisible();

    // ya no puede entrar
    const login = await request.post(`${BACKEND_URL}/login`, { data: { email: cliente.email, password: cliente.password } });
    expect(login.status()).toBe(401);
  });

  test("un administrador no ve la opción de borrar su cuenta", async ({ page }) => {
    await iniciarSesion(page, ADMIN.email, ADMIN.password);
    await page.goto("/mi-cuenta");
    await expect(page.getByRole("heading", { name: /Mi Cuenta/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Borrar mi cuenta" })).toHaveCount(0);
  });
});
