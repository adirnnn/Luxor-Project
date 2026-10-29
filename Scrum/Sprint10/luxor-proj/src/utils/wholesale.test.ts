// Feedback del cliente: el precio de mayorista que se muestra usa la misma regla que el servidor
import { describe, it, expect } from "vitest";
import { wholesaleDiscount, wholesaleLabel } from "./wholesale";

describe("wholesaleDiscount", () => {
  it("aplica el porcentaje y no hace nada sin rol de mayorista", () => {
    expect(wholesaleDiscount(500, 20)).toBe(100);
    expect(wholesaleDiscount(500, undefined)).toBe(0);
  });

  it("nunca deja el cobro por debajo de Q5 (mínimo de Recurrente)", () => {
    expect(wholesaleDiscount(6, 50)).toBe(1);
  });

  it("muestra la etiqueta con el porcentaje", () => {
    expect(wholesaleLabel(15)).toBe("Precio mayorista (15% menos)");
  });
});
