import { formatPrice } from "./formatPrice";

describe("formatPrice", () => {
  it("muestra siempre dos decimales, una sola vez", () => {
    expect(formatPrice(390)).toBe("Q390.00");
    // el backend manda los precios como texto: antes la ficha mostraba "Q390.00.00"
    expect(formatPrice("390.00")).toBe("Q390.00");
    expect(formatPrice(12345.5)).toBe("Q12,345.50");
  });

  it("separa los miles con coma", () => {
    expect(formatPrice(1170)).toBe("Q1,170.00");
  });

  it("un valor vacío o inválido se muestra como Q0.00", () => {
    expect(formatPrice(null)).toBe("Q0.00");
    expect(formatPrice(undefined)).toBe("Q0.00");
    expect(formatPrice("abc")).toBe("Q0.00");
  });
});
