// SFTWRKEY-456 · Flujo 1: registro e inicio de sesión.
// En la tienda los clientes no se registran solos: el admin crea la cuenta desde su panel
// (/admin/nuevo-usuario, ver el manual del administrador) y el cliente entra con ella.
import { test, expect } from "@playwright/test";
import { ADMIN, correoUnico } from "./datos";
import { cerrarSesion, iniciarSesion } from "./ayudas";

test("el admin registra un cliente y el cliente inicia sesión con su cuenta", async ({ page }) => {
  const cliente = { nombre: "Ana Pruebas", email: correoUnico("registro"), password: "clave-segura-e2e" };

  // 1. el admin crea la cuenta
  await iniciarSesion(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/nuevo-usuario");
  await page.locator('input[name="name"]').fill(cliente.nombre);
  await page.locator('input[name="email"]').fill(cliente.email);
  await page.locator('input[name="password"]').fill(cliente.password);
  await page.getByRole("button", { name: "Crear Usuario" }).click();
  await expect(page.getByText("¡Usuario creado exitosamente!")).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  await cerrarSesion(page);

  // 2. con una contraseña equivocada no entra
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(cliente.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-clave");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page.getByText("Correo o contraseña incorrectos. Verifica tus datos.")).toBeVisible();

  // 3. con su contraseña entra y ve sus datos en Mi cuenta
  await iniciarSesion(page, cliente.email, cliente.password);
  await expect(page.getByRole("button", { name: /menú de la cuenta/i })).toContainText("Ana");
  await page.goto("/mi-cuenta");
  await expect(page.getByText(cliente.email)).toBeVisible();

  // 4. al salir vuelve a ser visitante
  await cerrarSesion(page);
  await page.goto("/mi-cuenta");
  await expect(page).toHaveURL(/\/login$/);
});
