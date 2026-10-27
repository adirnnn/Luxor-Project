// SFTWRKEY-455: los eventos de analítica mandan solo datos del catálogo y nunca rompen la tienda
import { describe, it, expect, vi, beforeEach } from "vitest";

const track = vi.fn();
let fail = false;
vi.mock("@vercel/analytics", () => ({
  track: (...args: unknown[]) => {
    if (fail) throw new Error("bloqueado por el navegador");
    track(...args);
  },
}));

import { trackAddToCart, trackPurchase, trackViewProduct } from "./analytics";

describe("analytics", () => {
  beforeEach(() => {
    track.mockReset();
    fail = false;
  });

  it("registra ver perfume, agregar al carrito y compra completada", () => {
    trackViewProduct("p1", "Oud Royal");
    trackAddToCart("p1", "Oud Royal", 2);
    trackPurchase(780, 2);

    expect(track).toHaveBeenNthCalledWith(1, "ver_perfume", { id: "p1", name: "Oud Royal" });
    expect(track).toHaveBeenNthCalledWith(2, "agregar_al_carrito", { id: "p1", name: "Oud Royal", cantidad: 2 });
    expect(track).toHaveBeenNthCalledWith(3, "compra_completada", { total: 780, productos: 2 });
  });

  it("si la analítica falla, no lanza error", () => {
    fail = true;
    expect(() => trackPurchase(10, 1)).not.toThrow();
  });
});
