// SFTWRKEY-451: la sesión vive en una cookie httpOnly. Corre en Chromium, Firefox y WebKit
// (el motor de Safari): el inicio y el cierre de sesión tienen que funcionar en los tres.
import { test, expect } from "@playwright/test";
import { ADMIN } from "./datos";
import { cerrarSesion, iniciarSesion } from "./ayudas";

test("la sesión queda en una cookie httpOnly que JavaScript no puede leer, y se puede entrar y salir", async ({ page, context }) => {
  await iniciarSesion(page, ADMIN.email, ADMIN.password);

  // 1. el navegador guardó la cookie de sesión con httpOnly y SameSite=Lax
  const sesion = (await context.cookies()).find((c) => c.name === "luxor_sesion");
  expect(sesion, "cookie de sesión").toBeTruthy();
  expect(sesion!.httpOnly).toBe(true);
  expect(sesion!.sameSite).toBe("Lax");
  expect(sesion!.path).toBe("/");

  // 2. desde la consola (JavaScript de la página) no se puede leer el token
  const desdeLaPagina = await page.evaluate(async () => {
    const guardado = [...Object.values(localStorage), ...Object.values(sessionStorage)].join(" ");
    const yo = await fetch("/api/me");
    return {
      cookies: document.cookie,
      hayJwtGuardado: /eyJ[\w-]+\.[\w-]+\./.test(guardado),
      tokenViejo: localStorage.getItem("luxor-auth-token"),
      // la página igual puede usar la sesión: el navegador manda la cookie solo
      meStatus: yo.status,
      meTraeToken: JSON.stringify(await yo.json()).includes("eyJ"),
    };
  });
  expect(desdeLaPagina.cookies).not.toContain("luxor_sesion");
  expect(desdeLaPagina.hayJwtGuardado).toBe(false);
  expect(desdeLaPagina.tokenViejo).toBeNull();
  expect(desdeLaPagina.meStatus).toBe(200);
  expect(desdeLaPagina.meTraeToken).toBe(false);

  // 3. al recargar la página la sesión sigue
  await page.reload();
  await expect(page.getByRole("button", { name: /menú de la cuenta/i })).toBeVisible();
  await page.goto("/mi-cuenta");
  await expect(page).toHaveURL(/\/mi-cuenta$/);

  // 4. al salir la cookie se borra y la API ya no reconoce la sesión
  await cerrarSesion(page);
  await expect.poll(async () => (await context.cookies()).some((c) => c.name === "luxor_sesion")).toBe(false);
  expect(await page.evaluate(async () => (await fetch("/api/me")).status)).toBe(401);
  await page.goto("/mi-cuenta");
  await expect(page).toHaveURL(/\/login$/);
});
