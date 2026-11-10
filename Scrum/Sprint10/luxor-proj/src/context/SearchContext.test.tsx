// La lupa del navbar: los perfumes del inventario de la tienda llegan sin notas (null) y la
// búsqueda no se puede caer por eso (antes dejaba la página en negro).
import { render, renderHook, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { SearchProvider, useSearch } from "./SearchContext";
import { AuthProvider } from "./AuthContext";
import { CartProvider } from "./CartContext";
import { Navbar } from "../components/layout/Navbar";

const CATALOGO = [
  {
    id: "khamrah", name: "Khamrah", brand: "Lattafa", price: 650, stock: 3, image: "/k.webp",
    description: "Dulce y especiado", notes: { salida: "Canela", corazon: "Dátiles", fondo: "Vainilla" },
  },
  {
    id: "asad", name: "Asad", brand: "Lattafa", price: 450, stock: 2, image: "/a.webp",
    description: null, notes: { salida: null, corazon: null, fondo: null },
  },
  {
    id: "agotado", name: "Asad Bourbon", brand: "Lattafa", price: 500, stock: 0, image: "/b.webp",
    description: null, notes: { salida: null, corazon: null, fondo: null },
  },
];

// AuthProvider envuelve window.fetch, así que las esperas usan el mock guardado aquí
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: string) =>
    String(url).endsWith("/products")
      ? new Response(JSON.stringify(CATALOGO), { status: 200 })
      : new Response("[]", { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const montarContexto = async () => {
  const { result } = renderHook(() => useSearch(), { wrapper: SearchProvider });
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  // espera a que llegue el catálogo
  await act(async () => {});
  return result;
};

describe("SearchContext", () => {
  it("busca entre perfumes sin notas ni descripción sin caerse", async () => {
    const buscar = await montarContexto();
    act(() => buscar.current.setQuery("asad"));
    expect(buscar.current.results.map((p) => p.id)).toEqual(["asad"]);
  });

  it("también busca por marca, ignora tildes y deja fuera los agotados", async () => {
    const buscar = await montarContexto();
    act(() => buscar.current.setQuery("LATTAFA "));
    expect(buscar.current.results.map((p) => p.id)).toEqual(["khamrah", "asad"]);
    act(() => buscar.current.setQuery("datiles"));
    expect(buscar.current.results.map((p) => p.id)).toEqual(["khamrah"]);
  });
});

describe("Navbar: resultados de la lupa", () => {
  it("muestra las notas del perfume y, si no tiene, su marca", async () => {
    render(
      <AuthProvider>
        <CartProvider>
          <SearchProvider>
            <MemoryRouter>
              <Navbar />
            </MemoryRouter>
          </SearchProvider>
        </CartProvider>
      </AuthProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await user.type(screen.getAllByPlaceholderText("Buscar fragancia...")[0], "lattafa");

    expect(await screen.findByText("Canela · Dátiles")).toBeInTheDocument();
    expect(screen.getByText("Asad")).toBeInTheDocument();
    expect(screen.getByText("Lattafa")).toBeInTheDocument();
  });
});
