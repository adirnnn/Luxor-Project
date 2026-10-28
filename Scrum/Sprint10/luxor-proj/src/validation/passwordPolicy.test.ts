// SFTWRKEY-409: la validación del navegador coincide con la del backend
import { describe, it, expect } from "vitest";
import { validatePassword } from "./passwordPolicy";

describe("validatePassword", () => {
  it("pide al menos 12 caracteres", () => {
    expect(validatePassword("Secreta123")).toMatch(/12 caracteres/);
    expect(validatePassword("Mi perfume favorito")).toBeNull();
  });

  it("rechaza más de 72 bytes", () => {
    expect(validatePassword("a".repeat(72))).toBeNull();
    expect(validatePassword("🔒".repeat(19))).toMatch(/72 bytes/);
  });
});
