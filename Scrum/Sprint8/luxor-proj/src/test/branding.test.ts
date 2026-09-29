// SFTWRKEY-392: la marca es "Perfumería Victoria". Evita que vuelva a aparecer "Habibi"
// en el código del frontend (textos, títulos, aria-labels) o en el index.html.
import html from "../../index.html?raw";

const fuentes = import.meta.glob<string>(["/src/**/*.{ts,tsx,css}", "!/src/**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("marca Perfumería Victoria", () => {
  it("ningún archivo del frontend menciona la marca anterior", () => {
    expect(Object.keys(fuentes).length).toBeGreaterThan(20);
    const conMarcaVieja = Object.entries(fuentes)
      .filter(([, contenido]) => /habibi/i.test(contenido))
      .map(([ruta]) => ruta);
    expect(conMarcaVieja).toEqual([]);
    expect(html).not.toMatch(/habibi/i);
  });

  it("el título de la pestaña y el favicon son los nuevos", () => {
    expect(html).toContain("<title>Perfumería Victoria</title>");
    expect(html).toContain('href="/favicon.svg"');
  });
});
