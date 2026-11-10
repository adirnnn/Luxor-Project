import { describe, expect, it } from "vitest";
import { filtrarPerfumes } from "./filtrarPerfumes";
import type { Product } from "../../services/productService";

const p = (id: string, name: string, brand?: string) => ({ id, name, brand, price: 100 }) as unknown as Product;
const catalogo = [
  p("khamrah", "Lattafa Khamrah", "Lattafa"),
  p("yara", "Lattafa Yara", "Lattafa"),
  p("erba-pura", "Xerjoff Erba Pura", "Xerjoff"),
  p("laventure", "Al Haramain L'Aventure", "Al Haramain"),
];

describe("filtrarPerfumes (buscador del panel)", () => {
  it("sin texto devuelve todo", () => {
    expect(filtrarPerfumes(catalogo, "  ")).toHaveLength(4);
  });
  it("busca por marca sin importar mayúsculas", () => {
    expect(filtrarPerfumes(catalogo, "LATTAFA").map((x) => x.id)).toEqual(["khamrah", "yara"]);
  });
  it("todas las palabras tienen que estar, en cualquier orden", () => {
    expect(filtrarPerfumes(catalogo, "yara lattafa").map((x) => x.id)).toEqual(["yara"]);
  });
  it("ignora tildes y busca por referencia", () => {
    expect(filtrarPerfumes([p("x", "Ámbar Árabe")], "ambar arabe")).toHaveLength(1);
    expect(filtrarPerfumes(catalogo, "erba-pura").map((x) => x.id)).toEqual(["erba-pura"]);
  });
  it("sin coincidencias devuelve una lista vacía", () => {
    expect(filtrarPerfumes(catalogo, "dior")).toEqual([]);
  });
});
