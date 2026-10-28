// SFTWRKEY-456: antes de los flujos se crea (o se repone) el perfume de las pruebas, con stock
// de sobra, para no gastar el stock de los perfumes reales del seed.
import { test as setup, expect } from "@playwright/test";
import { ADMIN, BACKEND_URL, PERFUME } from "./datos";
import { tokenDe } from "./ayudas";

setup("crear el perfume de las pruebas", async ({ request }) => {
  const token = await tokenDe(request, ADMIN.email, ADMIN.password);
  const perfume = {
    name: PERFUME.name,
    price: PERFUME.price,
    image: "/assets/products/lattafaKhamrah.webp",
    description: "Perfume que usan las pruebas de extremo a extremo.",
    stock: 500,
    category_id: 1,
    brand: "Pruebas",
    notes: { salida: "Bergamota", corazon: "Rosa", fondo: "Ámbar" },
  };
  const headers = { Authorization: `Bearer ${token}` };

  const actualizado = await request.put(`${BACKEND_URL}/products/${PERFUME.id}`, { headers, data: perfume });
  if (actualizado.status() === 404) {
    const creado = await request.post(`${BACKEND_URL}/products`, { headers, data: { id: PERFUME.id, ...perfume } });
    expect(creado.status()).toBe(201);
  } else {
    expect(actualizado.ok()).toBeTruthy();
  }
});
