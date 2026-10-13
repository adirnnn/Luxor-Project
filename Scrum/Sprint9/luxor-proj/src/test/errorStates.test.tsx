// SFTWRKEY-423: página 404 y estados de carga/error. Con el backend apagado ninguna página
// queda en blanco ni muestra el texto técnico "Failed to fetch".
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { WishlistProvider } from "../context/WishlistContext";
import { SearchProvider } from "../context/SearchContext";
import { friendlyError, NETWORK_ERROR_MESSAGE } from "../services/apiClient";
import NotFoundPage from "../pages/NotFoundPage";
import ProductPage from "../pages/ProductPage";
import PerfumesPage from "../pages/PerfumesPage";
import { FeaturedPerfumesSection } from "../features/perfumes/FeaturedPerfumesSection";

function abrir(element: ReactElement, path: string, routePath = path) {
  return render(
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <SearchProvider>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route path={routePath} element={element} />
              </Routes>
            </MemoryRouter>
          </SearchProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

// fetch real del navegador cuando el servidor no responde
const backendApagado = () =>
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

afterEach(() => vi.restoreAllMocks());

describe("friendlyError", () => {
  it("cambia el error de red por un mensaje para el cliente", () => {
    expect(friendlyError(new TypeError("Failed to fetch"), "x")).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("deja los mensajes propios y usa el respaldo si no hay mensaje", () => {
    expect(friendlyError(new Error("Producto agotado"), "x")).toBe("Producto agotado");
    expect(friendlyError("raro", "respaldo")).toBe("respaldo");
  });
});

describe("página 404", () => {
  it("muestra el aviso con la identidad de la tienda y un enlace al inicio", () => {
    abrir(<NotFoundPage />, "/ruta/que-no-existe", "*");

    expect(screen.getByRole("heading", { name: /esta página no existe/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al inicio/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /ver el catálogo/i })).toHaveAttribute("href", "/perfumes");
  });
});

describe("detalle de producto", () => {
  it("un producto que no existe muestra un mensaje amable y lleva al catálogo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Producto no encontrado" }), { status: 404 })
    );

    abrir(<ProductPage />, "/producto/id-inexistente", "/producto/:id");

    expect(await screen.findByRole("heading", { name: /este perfume no está disponible/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver el catálogo/i })).toHaveAttribute("href", "/perfumes");
  });

  it("con el backend apagado muestra un mensaje de conexión, no 'Failed to fetch'", async () => {
    backendApagado();

    abrir(<ProductPage />, "/producto/khamrah", "/producto/:id");

    expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cargando producto/i)).not.toBeInTheDocument();
  });
});

describe("con el backend apagado", () => {
  it("las fragancias destacadas del inicio muestran un error en vez de quedar vacías", async () => {
    backendApagado();

    abrir(<FeaturedPerfumesSection />, "/");

    expect(await screen.findByText(NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/cargando fragancias/i)).not.toBeInTheDocument();
  });

  it("el catálogo muestra un error en vez de quedar cargando", async () => {
    backendApagado();

    abrir(<PerfumesPage />, "/perfumes");

    expect(await screen.findByText(/no pudimos cargar el catálogo/i)).toBeInTheDocument();
    expect(screen.queryByText(/cargando productos/i)).not.toBeInTheDocument();
  });
});
