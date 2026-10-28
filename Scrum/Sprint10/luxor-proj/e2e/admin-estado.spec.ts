// SFTWRKEY-456 · Flujo 4: el administrador cambia el estado de un pedido.
import { test, expect } from "@playwright/test";
import { ADMIN, BACKEND_URL } from "./datos";
import { comprarPorApi, crearCliente, iniciarSesion, tokenAdmin } from "./ayudas";

test("el admin pasa un pedido a preparación y después a enviado, y el cliente lo ve", async ({ page, request }) => {
  // un pedido nuevo de un cliente (se prepara por la API; lo que se prueba es el panel)
  const cliente = await crearCliente(request);
  const numero = await comprarPorApi(request, cliente);

  await iniciarSesion(page, ADMIN.email, ADMIN.password);
  await page.goto("/admin/pedidos");

  // abre el detalle del pedido desde la tabla
  const fila = page.getByRole("row", { name: new RegExp(`#${numero}\\b`) });
  await expect(fila).toContainText("Pagado");
  await fila.getByRole("button", { name: "Ver detalle" }).click();
  const detalle = page.getByRole("dialog");
  await expect(detalle).toContainText(`#${numero}`);

  // pagado -> en preparación -> enviado
  for (const estado of ["En preparación", "Enviado"]) {
    await detalle.getByLabel("Nuevo estado").selectOption({ label: estado });
    await detalle.getByRole("button", { name: "Actualizar estado" }).click();
    await expect(detalle.getByRole("status")).toBeVisible();
    await expect(detalle).toContainText(estado);
  }
  await detalle.getByRole("button", { name: "Cerrar" }).click();
  await expect(fila).toContainText("Enviado");

  // el cliente ve el estado nuevo en sus pedidos
  const res = await request.get(`${BACKEND_URL}/user/${cliente.id}/orders`, {
    headers: { Authorization: `Bearer ${tokenAdmin()}` },
  });
  const pedidos = await res.json();
  const pedido = (Array.isArray(pedidos) ? pedidos : pedidos.orders).find((o: { id: number }) => o.id === numero);
  expect(pedido.status).toBe("enviado");
});
