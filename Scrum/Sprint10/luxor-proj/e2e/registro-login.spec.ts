// SFTWRKEY-456 · Flujo 1: registro e inicio de sesión.
// Una cuenta se crea de dos formas: el cliente solo, desde "Crear cuenta" en /login (queda con la
// sesión iniciada), o el admin desde su panel (/admin/nuevo-usuario).
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
  // el panel se carga aparte (lazy): la URL cambia antes de que aparezca, y si se abre el menú
  // en ese momento, el panel nuevo lo reemplaza cerrado y "Salir" nunca vuelve a salir
  await expect(page.getByRole("heading", { name: "Panel Maestro" })).toBeVisible();
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

test.describe("registro desde la tienda", () => {
  // otra IP, como otro visitante: /register permite 6 por hora por IP y los demás flujos ya crean
  // sus clientes desde la IP de chromium
  test.use({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.21" } });

  test("el cliente crea su cuenta desde Entrar y queda con la sesión iniciada", async ({ page }) => {
    const cliente = { nombre: "Luis Registro", email: correoUnico("autoregistro"), password: "clave-segura-e2e" };

    await page.goto("/login");
    await page.getByRole("link", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/registro$/);
    await expect(page.getByRole("heading", { name: "CREAR CUENTA" })).toBeVisible();

    await page.getByLabel("Nombre completo").fill(cliente.nombre);
    await page.getByLabel("Correo electrónico").fill(cliente.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(cliente.password);
    await page.getByLabel("Confirmar contraseña").fill(cliente.password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // entra solo y vuelve a la portada
    await expect(page.getByRole("button", { name: /menú de la cuenta/i })).toContainText("Luis");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/mi-cuenta");
    await expect(page.getByText(cliente.email)).toBeVisible();
    await page.goto("/");
    await cerrarSesion(page);

    // con el mismo correo ya no se puede registrar otra vez
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Otra Persona");
    await page.getByLabel("Correo electrónico").fill(cliente.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(cliente.password);
    await page.getByLabel("Confirmar contraseña").fill(cliente.password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("El correo ya está registrado.")).toBeVisible();

    // y desde registro se vuelve a Entrar
    await page.getByRole("link", { name: "Inicia sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
