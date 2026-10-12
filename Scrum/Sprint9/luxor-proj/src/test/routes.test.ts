// Todo enlace interno del frontend (to="/..." y navigate("/...")) debe llevar a una ruta que
// exista en App.tsx. Evita botones que terminan en una página en blanco, como "Ver mis compras",
// que apuntaba a /user en lugar de /mi-cuenta.
import app from "../app/App.tsx?raw";

const fuentes = import.meta.glob<string>(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const rutas = Array.from(app.matchAll(/path="([^"]+)"/g), (m) => m[1]);

// "/producto/:id" -> /^\/producto\/[^/]+$/
const patrones = rutas.map((ruta) => new RegExp(`^${ruta.replace(/:[^/]+/g, "[^/]+")}$`));

describe("enlaces internos", () => {
  it("App.tsx define las rutas principales", () => {
    expect(rutas).toEqual(expect.arrayContaining(["/", "/perfumes", "/mi-cuenta", "/pago", "/cart"]));
  });

  it("cada enlace con ruta fija lleva a una ruta que existe", () => {
    const rotos: string[] = [];
    for (const [archivo, codigo] of Object.entries(fuentes)) {
      const destinos = [
        ...Array.from(codigo.matchAll(/\bto=["']([^"']+)["']/g), (m) => m[1]),
        ...Array.from(codigo.matchAll(/navigate\(["']([^"']+)["']/g), (m) => m[1]),
      ];
      for (const destino of destinos) {
        // sin la parte de ?query o #ancla; los archivos estáticos (como /favicon.svg) no son rutas
        const ruta = destino.split(/[?#]/)[0] || "/";
        if (!ruta.startsWith("/") || /\.\w+$/.test(ruta)) continue;
        if (!patrones.some((p) => p.test(ruta))) rotos.push(`${archivo}: ${destino}`);
      }
    }
    expect(rotos).toEqual([]);
  });
});
