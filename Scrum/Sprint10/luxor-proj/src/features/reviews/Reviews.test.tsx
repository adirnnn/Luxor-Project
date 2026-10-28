// SFTWRKEY-431: reseñas y calificaciones en la tarjeta, la ficha, Mi cuenta y el panel
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { ProductCard } from "../perfumes/ProductCard";
import { ProductDetail } from "../perfumes/ProductDetail";
import { ProductReviews } from "./ProductReviews";
import { OrderItemReview } from "./OrderItemReview";
import AdminReviewsPage from "../../pages/AdminReviewsPage";
import { AuthProvider } from "../../context/AuthContext";
import { CartProvider } from "../../context/CartContext";
import { SearchProvider } from "../../context/SearchContext";
import { createReview, fetchAdminReviews, fetchProductReviews, setReviewHidden } from "../../services/reviewService";
import type { AdminReview, MyReview } from "../../services/reviewService";

vi.mock("../../services/reviewService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/reviewService")>()),
  fetchProductReviews: vi.fn(),
  createReview: vi.fn(),
  fetchAdminReviews: vi.fn(),
  setReviewHidden: vi.fn(),
}));
const resenasDe = vi.mocked(fetchProductReviews);
const publicar = vi.mocked(createReview);
const listarAdmin = vi.mocked(fetchAdminReviews);
const ocultar = vi.mocked(setReviewHidden);

const SCRIPT = "<script>window.__xss = true</script>";
const IMG = "<img src=x onerror=\"window.__xss = true\">";

declare global {
  interface Window { __xss?: boolean }
}

const NOTAS = { salida: "Canela", corazon: "Praliné", fondo: "Vainilla" };

const RESENA: MyReview = {
  id: 3, order_id: 15, product_id: "khamrah", rating: 4, comment: "Muy rica", hidden: false, created_at: "2026-10-25T10:00:00Z",
};

beforeEach(() => {
  window.__xss = false;
  resenasDe.mockReset();
  publicar.mockReset();
  listarAdmin.mockReset();
  ocultar.mockReset();
});

describe("tarjeta del perfume", () => {
  it("muestra el promedio y la cantidad de reseñas (el promedio llega como texto)", () => {
    render(
      <MemoryRouter>
        <ProductCard id="khamrah" name="Lattafa Khamrah" price={650} image="/k.webp" ratingAvg="4.50" ratingCount={12} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: "4.5 de 5 estrellas" })).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12 reseñas)")).toBeInTheDocument();
  });

  it("sin reseñas no muestra estrellas", () => {
    render(
      <MemoryRouter>
        <ProductCard id="khamrah" name="Lattafa Khamrah" price={650} image="/k.webp" ratingAvg={null} ratingCount={0} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("img", { name: /de 5 estrellas/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/sin reseñas/i)).not.toBeInTheDocument();
  });
});

describe("ficha del perfume", () => {
  it("muestra el promedio con un enlace a la lista de reseñas", () => {
    render(
      <MemoryRouter>
        <ProductDetail id="khamrah" name="Lattafa Khamrah" price={650} image="/k.webp" description="Dulce" notes={NOTAS} rating_avg="4.67" rating_count={1} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: "4.7 de 5 estrellas" })).toBeInTheDocument();
    expect(screen.getByText("(1 reseña)").closest("a")).toHaveAttribute("href", "#resenas");
  });

  it("sin reseñas avisa que aún no tiene", () => {
    render(
      <MemoryRouter>
        <ProductDetail id="khamrah" name="Lattafa Khamrah" price={650} image="/k.webp" description="Dulce" notes={NOTAS} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Aún sin reseñas")).toBeInTheDocument();
  });

  it("lista las reseñas visibles y muestra un comentario con HTML como texto", async () => {
    resenasDe.mockResolvedValue({
      average: 4.5,
      count: 2,
      reviews: [
        { id: 2, rating: 5, comment: IMG, created_at: "2026-10-26T10:00:00Z", author: "María G." },
        { id: 1, rating: 4, comment: SCRIPT, created_at: "2026-10-25T10:00:00Z", author: "Carlos" },
      ],
    });

    const { container } = render(
      <MemoryRouter>
        <ProductReviews productId="khamrah" />
      </MemoryRouter>,
    );

    expect(await screen.findByText(IMG)).toBeInTheDocument();
    expect(screen.getByText(SCRIPT)).toBeInTheDocument();
    expect(screen.getByText("María G.")).toBeInTheDocument();
    expect(screen.getByText("(2 reseñas)")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelectorAll("img[onerror]")).toHaveLength(0);
    expect(window.__xss).toBe(false);
    expect(resenasDe).toHaveBeenCalledWith("khamrah");
  });

  it("sin reseñas lo dice e indica cómo calificar desde Mi cuenta", async () => {
    resenasDe.mockResolvedValue({ average: null, count: 0, reviews: [] });

    render(
      <MemoryRouter>
        <ProductReviews productId="khamrah" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Este perfume todavía no tiene reseñas.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/mi-cuenta");
  });
});

describe("Mi cuenta: calificar un perfume entregado", () => {
  it("elige estrellas, escribe un comentario y publica", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    publicar.mockResolvedValue({ review: RESENA, rating: { average: 4, count: 1 } });

    render(<OrderItemReview orderId={15} productId="khamrah" productName="Lattafa Khamrah" onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "Calificar Lattafa Khamrah" }));
    await user.click(screen.getByRole("radio", { name: /4 estrellas/ }));
    await user.type(screen.getByLabelText(/comentario/i), "  Muy rica  ");
    expect(screen.getByText("8/500")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publicar reseña" }));

    expect(publicar).toHaveBeenCalledWith({ orderId: 15, productId: "khamrah", rating: 4, comment: "Muy rica" });
    expect(onCreated).toHaveBeenCalledWith(RESENA);
  });

  it("no publica sin calificación", async () => {
    const user = userEvent.setup();
    render(<OrderItemReview orderId={15} productId="khamrah" productName="Lattafa Khamrah" onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Calificar Lattafa Khamrah" }));
    await user.click(screen.getByRole("button", { name: "Publicar reseña" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/elige una calificación/i);
    expect(publicar).not.toHaveBeenCalled();
  });

  it("el comentario no deja escribir más de 500 caracteres", async () => {
    const user = userEvent.setup();
    render(<OrderItemReview orderId={15} productId="khamrah" productName="Lattafa Khamrah" onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Calificar Lattafa Khamrah" }));
    expect(screen.getByLabelText(/comentario/i)).toHaveAttribute("maxLength", "500");
  });

  it("muestra el mensaje del backend si no se puede publicar", async () => {
    const user = userEvent.setup();
    publicar.mockRejectedValue(new Error("Ya calificaste este perfume en este pedido."));
    render(<OrderItemReview orderId={15} productId="khamrah" productName="Lattafa Khamrah" onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Calificar Lattafa Khamrah" }));
    await user.click(screen.getByRole("radio", { name: /5 estrellas/ }));
    await user.click(screen.getByRole("button", { name: "Publicar reseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya calificaste este perfume en este pedido.");
  });

  it("si ya lo calificó muestra su calificación en lugar del botón", () => {
    render(<OrderItemReview orderId={15} productId="khamrah" productName="Lattafa Khamrah" review={{ ...RESENA, hidden: true }} onCreated={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /calificar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4.0 de 5 estrellas" })).toBeInTheDocument();
    expect(screen.getByText(/la tienda la ocultó/i)).toBeInTheDocument();
  });
});

describe("panel: reseñas", () => {
  const ADMIN_RESENA: AdminReview = { ...RESENA, product_name: "Lattafa Khamrah", user_name: "María García", user_email: "maria@luxor.com" };

  function abrirPanel() {
    return render(
      <AuthProvider>
        <CartProvider>
          <SearchProvider>
            <MemoryRouter initialEntries={["/admin/resenas"]}>
              <AdminReviewsPage />
            </MemoryRouter>
          </SearchProvider>
        </CartProvider>
      </AuthProvider>,
    );
  }

  it("oculta una reseña y muestra el promedio nuevo del perfume", async () => {
    const user = userEvent.setup();
    listarAdmin.mockResolvedValue({ reviews: [ADMIN_RESENA], total: 1, page: 1, limit: 20 });
    ocultar.mockResolvedValue({ review: { ...RESENA, hidden: true }, rating: { average: 4.5, count: 2 } });
    abrirPanel();

    const tarjeta = (await screen.findByText("Muy rica")).closest("li")!;
    await user.click(within(tarjeta).getByRole("button", { name: "Ocultar" }));

    expect(ocultar).toHaveBeenCalledWith(3, true);
    expect(await screen.findByRole("status")).toHaveTextContent("Reseña oculta. El promedio de Lattafa Khamrah queda en 4.5 (2 reseñas).");
    expect(within(tarjeta).getByText("Oculta")).toBeInTheDocument();
    expect(within(tarjeta).getByRole("button", { name: "Mostrar" })).toBeInTheDocument();
  });

  it("filtra por reseñas ocultas", async () => {
    const user = userEvent.setup();
    listarAdmin.mockResolvedValue({ reviews: [], total: 0, page: 1, limit: 20 });
    abrirPanel();

    await screen.findByText("Aún no hay reseñas.");
    await user.selectOptions(screen.getByLabelText(/mostrar/i), "hidden");

    expect(listarAdmin).toHaveBeenLastCalledWith({ status: "hidden", page: 1, limit: 20 });
    expect(await screen.findByText("No hay reseñas con este filtro.")).toBeInTheDocument();
  });
});
