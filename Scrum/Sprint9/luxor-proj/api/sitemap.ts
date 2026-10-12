// SFTWRKEY-436: sitemap.xml con las páginas públicas y un perfume por entrada.
// vercel.json manda /sitemap.xml aquí. Se arma con el catálogo del backend y queda en la
// CDN de Vercel un día, así que el backend solo se consulta de vez en cuando.
// Archivo autocontenido a propósito, igual que product-preview.ts.

declare const process: { env: Record<string, string | undefined> };

// el backend en Render (plan gratis) puede tardar en despertar; los buscadores sí esperan
const BACKEND_TIMEOUT_MS = 20000;

// mismo formato que los ids del catálogo y de la importación CSV
const VALID_ID = /^[A-Za-z0-9-]{1,100}$/;

// páginas públicas; las privadas están bloqueadas en public/robots.txt
export const PUBLIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/perfumes", changefreq: "daily", priority: "0.9" },
  { path: "/privacidad", changefreq: "yearly", priority: "0.2" },
  { path: "/terminos", changefreq: "yearly", priority: "0.2" },
  { path: "/envios-devoluciones", changefreq: "yearly", priority: "0.3" },
];

export type SitemapProduct = {
  id: string;
  created_at?: string | null;
  synced_at?: string | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// fecha en formato W3C (YYYY-MM-DD), la última entre creación y sincronización con PerfumAPI
function lastModified(product: SitemapProduct): string | null {
  const dates = [product.synced_at, product.created_at]
    .map((d) => (d ? new Date(d) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10);
}

export function buildSitemap(products: SitemapProduct[], origin: string): string {
  const entries = [
    ...PUBLIC_PAGES.map(
      (page) =>
        `  <url>\n    <loc>${escapeXml(origin + page.path)}</loc>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`
    ),
    ...products
      .filter((p) => typeof p.id === "string" && VALID_ID.test(p.id))
      .map((p) => {
        const lastmod = lastModified(p);
        return [
          "  <url>",
          `    <loc>${escapeXml(`${origin}/producto/${p.id}`)}</loc>`,
          lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
          "    <changefreq>weekly</changefreq>",
          "    <priority>0.8</priority>",
          "  </url>",
        ]
          .filter(Boolean)
          .join("\n");
      }),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
}

async function fetchProducts(): Promise<SitemapProduct[] | null> {
  const api = (process.env.VITE_API_URL || process.env.API_URL || "").replace(/\/+$/, "");
  if (!api) return null;
  try {
    const res = await fetch(`${api}/products`, { signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as SitemapProduct[]) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const products = await fetchProducts();

  return new Response(buildSitemap(products ?? [], origin), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // con el catálogo, un día en la CDN (y se renueva en segundo plano);
      // sin él (backend dormido) solo las páginas fijas, por cinco minutos
      "Cache-Control": products
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "public, s-maxage=300",
    },
  });
}
