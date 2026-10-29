// Feedback del cliente: la portada muestra los más vendidos con pestañas por categoría
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { CartProvider } from "../../context/CartContext";
import { WishlistProvider } from "../../context/WishlistContext";
import { FeaturedPerfumesSection } from "./FeaturedPerfumesSection";
import { fetchBestSellers, fetchCategories } from "../../services/productService";

vi.mock("../../services/productService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/productService")>()),
  fetchBestSellers: vi.fn(),
  fetchCategories: vi.fn(),
}));
const masVendidos = vi.mocked(fetchBestSellers);
const categorias = vi.mocked(fetchCategories);

const perfume = (id: string, name: string) => ({
  id, name, price: 390, image: "/x.webp", stock: 5, description: "", rating_avg: null, rating_count: 0,
}) as unknown as Awaited<ReturnType<typeof fetchBestSellers>>[number];

function abrir() {
  return render(
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <MemoryRouter>
            <FeaturedPerfumesSection />
          </MemoryRouter>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  categorias.mockResolvedValue([{ id: 6, nombre: "Dulce" }]);
  masVendidos.mockImplementation(async (categoria) =>
    categoria === 6 ? [perfume("yara", "Lattafa Yara")] : [perfume("khamrah", "Lattafa Khamrah")]
  );
});

describe("FeaturedPerfumesSection", () => {
  it("muestra los más vendidos y cambia de categoría con las pestañas", async () => {
    const user = userEvent.setup();
    abrir();

    expect(await screen.findByText("Lattafa Khamrah")).toBeInTheDocument();
    expect(masVendidos).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole("link", { name: "Ver todo el catálogo" })).toHaveAttribute("href", "/perfumes");

    await user.click(await screen.findByRole("tab", { name: "Dulce" }));

    expect(await screen.findByText("Lattafa Yara")).toBeInTheDocument();
    expect(screen.queryByText("Lattafa Khamrah")).not.toBeInTheDocument();
    expect(masVendidos).toHaveBeenLastCalledWith(6);
    expect(screen.getByRole("tab", { name: "Dulce" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Ver todo Dulce" })).toHaveAttribute("href", "/perfumes?category=6");
  });
});
