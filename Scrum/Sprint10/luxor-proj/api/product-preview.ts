// SFTWRKEY-435: vista previa de un perfume para WhatsApp, Facebook, X y similares.
// Esos bots no ejecutan JavaScript, así que no ven lo que React pone en el <head>.
// vercel.json manda aquí /producto/:id solo cuando el user-agent es de un bot; los
// usuarios normales siguen recibiendo la SPA.
// Archivo autocontenido a propósito: Vercel lo compila como función de Node.js aparte.

declare const process: { env: Record<string, string | undefined> };

const SITE_NAME = "Perfumería Victoria";
const DEFAULT_TITLE = `${SITE_NAME} | Perfumes árabes auténticos`;
const DEFAULT_DESCRIPTION =
  "Perfumes árabes y de diseñador originales, con certificado de autenticidad y envío a todo el país en 24 a 48 horas.";
// el backend en Render (plan gratis) puede tardar en despertar; el bot no espera tanto
const BACKEND_TIMEOUT_MS = 3500;

// mismo formato que los ids del catálogo y de la importación CSV
const VALID_ID = /^[A-Za-z0-9-]{1,100}$/;

export type PreviewProduct = {
  id: string;
  name: string;
  price: number | string;
  image?: string | null;
  brand?: string | null;
  notes?: { salida?: string | null; corazon?: string | null; fondo?: string | null } | null;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// misma descripción que src/seo/site.ts (productDescription)
export function describeProduct(product: PreviewProduct): string {
  const notes = [
    product.notes?.salida && `Salida: ${product.notes.salida}.`,
    product.notes?.corazon && `Corazón: ${product.notes.corazon}.`,
    product.notes?.fondo && `Fondo: ${product.notes.fondo}.`,
  ].filter(Boolean);
  const price = Number(product.price);
  return [product.brand ? `${product.brand} ·` : null, ...notes, Number.isFinite(price) ? `Q${price.toFixed(2)}` : null]
    .filter(Boolean)
    .join(" ");
}

// las imágenes del catálogo son rutas del frontend (/assets/...) o URLs externas (PerfumAPI)
function absoluteImage(image: string | null | undefined, origin: string): string {
  if (image && /^https:\/\//i.test(image)) return image;
  if (image && image.startsWith("/")) return `${origin}${image}`;
  return `${origin}/og-image.jpg`;
}

export function buildPreviewHtml(product: PreviewProduct | null, origin: string, path: string): string {
  const url = `${origin}${path}`;
  const title = product ? `${product.name} | ${SITE_NAME}` : DEFAULT_TITLE;
  const description = product ? describeProduct(product) : DEFAULT_DESCRIPTION;
  const image = product ? absoluteImage(product.image, origin) : `${origin}/og-image.jpg`;
  const price = product ? Number(product.price) : NaN;

  const meta: Array<[string, string, string]> = [
    ["name", "description", description],
    ["property", "og:type", product ? "product" : "website"],
    ["property", "og:site_name", SITE_NAME],
    ["property", "og:locale", "es_GT"],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:url", url],
    ["property", "og:image", image],
    ["property", "og:image:alt", product ? product.name : SITE_NAME],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", image],
  ];
  if (Number.isFinite(price)) {
    meta.push(["property", "product:price:amount", price.toFixed(2)], ["property", "product:price:currency", "GTQ"]);
  }

  const tags = meta
    .map(([attr, key, content]) => `    <meta ${attr}="${key}" content="${escapeHtml(content)}" />`)
    .join("\n");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${escapeHtml(url)}" />
${tags}
  </head>
  <body>
    <h1>${escapeHtml(product ? product.name : SITE_NAME)}</h1>
    <p>${escapeHtml(description)}</p>
    <a href="${escapeHtml(url)}">Ver en ${SITE_NAME}</a>
  </body>
</html>`;
}

async function fetchProduct(id: string): Promise<PreviewProduct | null> {
  const api = (process.env.VITE_API_URL || process.env.API_URL || "").replace(/\/+$/, "");
  if (!api) return null;
  try {
    const res = await fetch(`${api}/products/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PreviewProduct;
    return data && typeof data.name === "string" ? data : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const origin = url.origin;

  const product = VALID_ID.test(id) ? await fetchProduct(id) : null;
  const path = VALID_ID.test(id) ? `/producto/${id}` : "/";

  return new Response(buildPreviewHtml(product, origin, path), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // con producto se guarda una hora en la CDN; sin él (backend dormido) solo un minuto
      "Cache-Control": product
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "public, s-maxage=60",
    },
  });
}
