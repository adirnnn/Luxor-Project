// SFTWRKEY-436: sitemap.xml (api/sitemap.ts) y robots.txt
import { vi } from "vitest";
import { buildSitemap, GET, PUBLIC_PAGES } from "../../api/sitemap";
import robots from "../../public/robots.txt?raw";
import vercelConfig from "../../vercel.json";

const origin = "https://tienda.test";
const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

const parse = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
};
const locs = (doc: Document) => Array.from(doc.getElementsByTagNameNS(NS, "loc")).map((n) => n.textContent);

const catalogo = [
  { id: "khamrah", created_at: "2026-10-07T22:12:17.517Z", synced_at: null },
  { id: "yara", created_at: "2026-09-01T10:00:00Z", synced_at: "2026-10-02T08:00:00Z" },
];

describe("sitemap.xml", () => {
  it("es XML válido con el esquema de sitemaps.org", () => {
    const doc = parse(buildSitemap(catalogo, origin));
    expect(doc.documentElement.localName).toBe("urlset");
    expect(doc.documentElement.namespaceURI).toBe(NS);
    // cada <url> tiene un <loc>, y el sitemap no pasa del límite de 50 000 URLs
    const urls = doc.getElementsByTagNameNS(NS, "url");
    expect(urls.length).toBe(PUBLIC_PAGES.length + catalogo.length);
    expect(urls.length).toBeLessThanOrEqual(50000);
    for (const url of Array.from(urls)) {
      expect(url.getElementsByTagNameNS(NS, "loc")).toHaveLength(1);
    }
  });

  it("incluye las páginas públicas y un perfume por entrada, con URL absoluta", () => {
    const urls = locs(parse(buildSitemap(catalogo, origin)));
    expect(urls).toEqual([
      "https://tienda.test/",
      "https://tienda.test/perfumes",
      "https://tienda.test/privacidad",
      "https://tienda.test/terminos",
      "https://tienda.test/envios-devoluciones",
      "https://tienda.test/preguntas-frecuentes",
      "https://tienda.test/producto/khamrah",
      "https://tienda.test/producto/yara",
    ]);
  });

  it("no incluye páginas privadas", () => {
    const xml = buildSitemap(catalogo, origin);
    for (const privada of ["/admin", "/reporte", "/mi-cuenta", "/cart", "/pago", "/login"]) {
      expect(xml).not.toContain(`${origin}${privada}<`);
    }
  });

  it("usa la fecha más reciente entre creación y sincronización como lastmod", () => {
    const xml = buildSitemap(catalogo, origin);
    expect(xml).toContain("<loc>https://tienda.test/producto/khamrah</loc>\n    <lastmod>2026-10-07</lastmod>");
    expect(xml).toContain("<loc>https://tienda.test/producto/yara</loc>\n    <lastmod>2026-10-02</lastmod>");
  });

  it("ignora ids con caracteres raros (no se puede inyectar XML)", () => {
    const xml = buildSitemap([{ id: "x</loc><loc>https://otro.test" }, { id: "ok-1" }], origin);
    parse(xml);
    expect(xml).not.toContain("otro.test");
    expect(xml).toContain("/producto/ok-1</loc>");
  });

  describe("GET", () => {
    beforeEach(() => vi.stubEnv("VITE_API_URL", "https://api.test"));
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("arma el sitemap con el catálogo del backend y lo guarda un día en la CDN", async () => {
      const fetchMock = vi.fn(async () => Response.json(catalogo));
      vi.stubGlobal("fetch", fetchMock);
      const res = await GET(new Request(`${origin}/api/sitemap`));
      expect(fetchMock).toHaveBeenCalledWith("https://api.test/products", expect.anything());
      expect(res.headers.get("Content-Type")).toContain("application/xml");
      expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
      expect(locs(parse(await res.text()))).toContain("https://tienda.test/producto/yara");
    });

    it("si el backend no responde, devuelve solo las páginas fijas por poco tiempo", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
      const res = await GET(new Request(`${origin}/api/sitemap`));
      expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=300");
      expect(locs(parse(await res.text()))).toHaveLength(PUBLIC_PAGES.length);
    });
  });
});

describe("robots.txt", () => {
  it("bloquea las páginas privadas y apunta al sitemap", () => {
    for (const ruta of ["/admin", "/reporte", "/mi-cuenta", "/cart", "/pago"]) {
      expect(robots).toMatch(new RegExp(`^Disallow: ${ruta}$`, "m"));
    }
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m);
  });
});

describe("vercel.json", () => {
  it("manda /sitemap.xml a la función antes de la regla que manda todo a index.html", () => {
    const sources = vercelConfig.rewrites.map((r) => r.source);
    const regla = vercelConfig.rewrites.find((r) => r.source === "/sitemap.xml");
    expect(regla?.destination).toBe("/api/sitemap");
    expect(sources.indexOf("/sitemap.xml")).toBeLessThan(sources.indexOf("/(.*)"));
  });
});
