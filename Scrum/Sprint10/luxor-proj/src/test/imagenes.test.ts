// SFTWRKEY-457: las fotos de productos son WebP. Revisa que no falte ninguna foto, que cada una tenga
// su JPEG para compartir en redes y que las rutas viejas (.png/.jpg) sigan llegando a la foto nueva.
import seed from "../../backend/seed.js?raw";
import productosEstaticos from "../data/products.ts?raw";
import vercelConfig from "../../vercel.json";

const archivos = Object.keys(
  import.meta.glob("/public/assets/products/**/*", { query: "?url", import: "default", eager: true })
).map((ruta) => ruta.replace(/^\/public/, ""));

const rutasEn = (codigo: string) => [...codigo.matchAll(/\/assets\/products\/[\w.-]+/g)].map((m) => m[0]);

describe("fotos de productos (SFTWRKEY-457)", () => {
  it("cada foto que usan el seed y data/products.ts existe en public/", () => {
    const usadas = [...new Set([...rutasEn(seed), ...rutasEn(productosEstaticos)])];
    expect(usadas.length).toBeGreaterThan(15);
    expect(usadas.filter((ruta) => !archivos.includes(ruta))).toEqual([]);
  });

  it("ya no quedan fotos .png ni .jpg pesadas, solo WebP (y el SVG de relleno)", () => {
    const sueltas = archivos.filter((ruta) => !ruta.includes("/og/"));
    expect(sueltas.filter((ruta) => !/\.(webp|svg)$/.test(ruta))).toEqual([]);
  });

  it("cada foto WebP tiene su JPEG para compartir en public/assets/products/og/", () => {
    const webp = archivos.filter((ruta) => /^\/assets\/products\/[^/]+\.webp$/.test(ruta));
    expect(webp.length).toBe(16);
    const sinJpg = webp.filter((ruta) => !archivos.includes(ruta.replace("/products/", "/products/og/").replace(/\.webp$/, ".jpg")));
    expect(sinJpg).toEqual([]);
  });
});

describe("vercel.json para las fotos (SFTWRKEY-457)", () => {
  const sources = vercelConfig.rewrites.map((r) => r.source);
  const catchAll = sources.indexOf("/(.*)");

  it("las rutas viejas .png y .jpg de un perfume se sirven con su .webp", () => {
    for (const extension of ["png", "jpg"]) {
      const regla = vercelConfig.rewrites.find((r) => r.source === `/assets/products/:foto([^/]+)\\.${extension}`);
      expect(regla?.destination).toBe("/assets/products/:foto.webp");
      expect(sources.indexOf(regla!.source)).toBeLessThan(catchAll);
    }
  });

  it("las fotos subidas desde el panel van al backend y Vercel las guarda en su CDN", () => {
    const regla = vercelConfig.rewrites.find((r) => r.source === "/product-images/:file");
    expect(regla?.destination).toMatch(/^https:\/\/.+\/product-images\/:file$/);
    expect(sources.indexOf("/product-images/:file")).toBeLessThan(catchAll);
    const cabeceras = vercelConfig.headers.find((h) => h.source === "/product-images/:file")?.headers ?? [];
    expect(cabeceras).toContainEqual({ key: "x-vercel-enable-rewrite-caching", value: "1" });
  });
});
