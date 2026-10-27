// SFTWRKEY-435: títulos por página, noindex y vista previa de productos para redes sociales
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { PageMeta } from "../components/seo/PageMeta";
import { productDescription } from "./site";
import { buildPreviewHtml, describeProduct, GET, shareImage } from "../../api/product-preview";
import vercelConfig from "../../vercel.json";

const khamrah = {
  id: "khamrah",
  name: "Lattafa Khamrah",
  price: "390.00",
  image: "/assets/products/lattafaKhamrah.webp",
  brand: "Lattafa",
  notes: { salida: "Canela, dátiles", corazon: "Praliné, vainilla", fondo: "Madera, ámbar" },
};

const robots = () => document.head.querySelector('meta[name="robots"]');

describe("PageMeta", () => {
  it("pone el título de la página con el nombre de la tienda", () => {
    render(<PageMeta title="Carrito" />);
    expect(document.title).toBe("Carrito | Perfumería Victoria");
    expect(robots()).toBeNull();
  });

  it("sin título usa el de la página de inicio", () => {
    render(<PageMeta />);
    expect(document.title).toBe("Perfumería Victoria | Perfumes árabes auténticos");
  });

  it("las páginas privadas llevan noindex", () => {
    render(<PageMeta title="Mi cuenta" noindex />);
    expect(robots()).toHaveAttribute("content", "noindex, nofollow");
  });
});

describe("descripción del producto", () => {
  it("incluye marca, notas y precio", () => {
    expect(productDescription(khamrah)).toBe(
      "Lattafa · Salida: Canela, dátiles. Corazón: Praliné, vainilla. Fondo: Madera, ámbar. Q390.00"
    );
  });

  it("la página y la vista previa de redes generan el mismo texto", () => {
    expect(describeProduct(khamrah)).toBe(productDescription(khamrah));
    const sinMarca = { ...khamrah, brand: null, notes: { salida: "Rosa", corazon: null, fondo: null } };
    expect(describeProduct(sinMarca)).toBe(productDescription(sinMarca));
  });
});

describe("vista previa para bots (api/product-preview)", () => {
  const origin = "https://tienda.test";

  it("arma las etiquetas og: del perfume con la imagen en URL absoluta", () => {
    const html = buildPreviewHtml(khamrah, origin, "/producto/khamrah");
    expect(html).toContain('<meta property="og:title" content="Lattafa Khamrah | Perfumería Victoria" />');
    expect(html).toContain('<meta property="og:image" content="https://tienda.test/assets/products/og/lattafaKhamrah.jpg" />');
    expect(html).toContain('<meta property="og:url" content="https://tienda.test/producto/khamrah" />');
    expect(html).toContain('<meta property="product:price:amount" content="390.00" />');
  });

  // SFTWRKEY-457: al compartir se usa la versión JPEG de la foto
  it.each([
    ["/assets/products/lattafaKhamrah.webp", "/assets/products/og/lattafaKhamrah.jpg"],
    ["/assets/products/lattafaKhamrah.png", "/assets/products/og/lattafaKhamrah.jpg"],
    ["/assets/products/asad.jpg", "/assets/products/og/asad.jpg"],
    ["/product-images/12.webp", "/product-images/12.jpg"],
    ["/otra/foto.webp", "/otra/foto.webp"],
  ])("la foto %s se comparte como %s", (image, esperada) => {
    expect(shareImage(image)).toBe(esperada);
  });

  it("un perfume sin foto (imagen de relleno SVG) se comparte con la imagen de la tienda", () => {
    const html = buildPreviewHtml({ ...khamrah, image: "/assets/products/sin-imagen.svg" }, origin, "/producto/khamrah");
    expect(html).toContain('<meta property="og:image" content="https://tienda.test/og-image.jpg" />');
  });

  it("escapa el contenido del producto (no se puede inyectar HTML)", () => {
    const malicioso = { ...khamrah, name: '"><script>alert(1)</script>' };
    const html = buildPreviewHtml(malicioso, origin, "/producto/khamrah");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("sin producto usa la vista previa de la tienda", () => {
    const html = buildPreviewHtml(null, origin, "/");
    expect(html).toContain('<meta property="og:image" content="https://tienda.test/og-image.jpg" />');
    expect(html).toContain("Perfumes árabes auténticos");
  });

  describe("GET", () => {
    beforeEach(() => vi.stubEnv("VITE_API_URL", "https://api.test"));
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("consulta el producto al backend y lo guarda una hora en la CDN", async () => {
      const fetchMock = vi.fn(async () => Response.json(khamrah));
      vi.stubGlobal("fetch", fetchMock);
      const res = await GET(new Request(`${origin}/api/product-preview?id=khamrah`));
      expect(fetchMock).toHaveBeenCalledWith("https://api.test/products/khamrah", expect.anything());
      expect(res.headers.get("Content-Type")).toContain("text/html");
      expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
      expect(await res.text()).toContain("Lattafa Khamrah | Perfumería Victoria");
    });

    it("con un id inválido no llama al backend", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await GET(new Request(`${origin}/api/product-preview?id=../../admin`));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await res.text()).toContain("og-image.jpg");
    });

    it("si el backend falla o no responde, devuelve la vista previa de la tienda", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
      const res = await GET(new Request(`${origin}/api/product-preview?id=khamrah`));
      expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=60");
      expect(await res.text()).toContain("og-image.jpg");
    });
  });
});

describe("regla de vercel.json para bots", () => {
  const regla = vercelConfig.rewrites.find((r) => r.source === "/producto/:id");
  const patron = new RegExp(regla?.has?.[0].value ?? "^$");

  it.each([
    "WhatsApp/2.23.20.0 A",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Twitterbot/1.0",
  ])("manda a la función el user-agent %s", (ua) => {
    expect(patron.test(ua)).toBe(true);
  });

  it("un navegador normal recibe la SPA", () => {
    expect(patron.test("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36")).toBe(false);
  });

  it("la regla de bots va antes de la que manda todo a index.html", () => {
    const sources = vercelConfig.rewrites.map((r) => r.source);
    expect(sources.indexOf("/producto/:id")).toBeLessThan(sources.indexOf("/(.*)"));
  });
});
