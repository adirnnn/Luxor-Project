// SFTWRKEY-445/456: Recurrente simulado para las pruebas de extremo a extremo.
// Responde las mismas rutas de la API que usa el backend (crear y leer un checkout) y muestra una
// "página de pago" con botones para pagar, rechazar la tarjeta o salirse, que regresan a la tienda
// igual que la página real. El backend lo usa con RECURRENTE_API_URL (solo fuera de producción).
import http from "node:http";

const PORT = Number(process.env.PORT ?? 3200);
const BASE = `http://localhost:${PORT}`;
const checkouts = new Map();
let siguiente = 0;

const leerCuerpo = (req) =>
  new Promise((resolve) => {
    let datos = "";
    req.on("data", (parte) => (datos += parte));
    req.on("end", () => resolve(datos));
  });

const json = (res, status, cuerpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};

const redirigir = (res, url) => {
  res.writeHead(303, { Location: url });
  res.end();
};

// lo mismo que devuelve GET /api/checkouts/:id de Recurrente (solo los campos que usa la tienda)
const comoApi = (id, c) => ({
  id,
  status: c.status,
  checkout_url: `${BASE}/checkout-session/${id}`,
  payment: c.status === "paid" ? { id: `pa_${id}` } : null,
  payment_method: c.status === "paid" ? { type: "card", card: { last4: "4242", network: "visa" } } : null,
  latest_intent: c.rechazo ? { status: "failed", details: { failure_reason: c.rechazo } } : null,
});

const pagina = (id, c) => {
  const total = c.items.reduce((suma, i) => suma + i.amount_in_cents * i.quantity, 0) / 100;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recurrente (simulado)</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto">
  <h1>Recurrente (simulado)</h1>
  <p>Total a pagar: Q${total.toFixed(2)}</p>
  ${c.rechazo ? `<p role="alert">Pago rechazado: ${c.rechazo}</p>` : ""}
  <form method="post" action="/checkout-session/${id}/pagar"><button>Pagar</button></form>
  <form method="post" action="/checkout-session/${id}/rechazar"><button>Rechazar tarjeta</button></form>
  <form method="post" action="/checkout-session/${id}/salir"><button>Salir sin pagar</button></form>
</body></html>`;
};

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const partes = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/health") return json(res, 200, { ok: true });

  // API: crear checkout
  if (req.method === "POST" && url.pathname === "/api/checkouts") {
    if (!req.headers["x-secret-key"]) return json(res, 401, { message: "Falta X-SECRET-KEY" });
    const cuerpo = JSON.parse((await leerCuerpo(req)) || "{}");
    const id = `ch_e2e_${++siguiente}`;
    checkouts.set(id, { status: "unpaid", items: cuerpo.items ?? [], successUrl: cuerpo.success_url, cancelUrl: cuerpo.cancel_url });
    return json(res, 201, comoApi(id, checkouts.get(id)));
  }

  // API: leer checkout
  if (req.method === "GET" && partes[0] === "api" && partes[1] === "checkouts" && partes[2]) {
    const c = checkouts.get(partes[2]);
    return c ? json(res, 200, comoApi(partes[2], c)) : json(res, 404, { message: "No existe" });
  }

  // página de pago
  if (partes[0] === "checkout-session" && checkouts.has(partes[1])) {
    const id = partes[1];
    const c = checkouts.get(id);
    if (req.method === "GET" && partes.length === 2) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(pagina(id, c));
    }
    if (req.method === "POST" && partes[2] === "pagar") {
      c.status = "paid";
      c.rechazo = null;
      return redirigir(res, c.successUrl);
    }
    if (req.method === "POST" && partes[2] === "rechazar") {
      c.rechazo = "Fondos insuficientes";
      return redirigir(res, `/checkout-session/${id}`);
    }
    if (req.method === "POST" && partes[2] === "salir") return redirigir(res, c.cancelUrl);
  }

  json(res, 404, { message: "Ruta desconocida" });
});

servidor.listen(PORT, () => console.log(`Recurrente simulado en ${BASE}`));
