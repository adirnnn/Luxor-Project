// SFTWRKEY-420: estado y detalle de los pedidos en "Mi cuenta"
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { SearchProvider } from "../context/SearchContext";
import UserPage from "./UserPage";

const PEDIDOS = [
  {
    id: 2, total: "330.00", status: "enviado", created_at: "2026-10-02T10:00:00Z",
    items: [{ product_id: "yara", name: "Lattafa Yara", image: "/y.png", quantity: 1, unit_price: "330.00" }],
    history: [
      { from_status: null, to_status: "pagado", changed_at: "2026-10-02T10:00:00Z" },
      { from_status: "pagado", to_status: "en_preparacion", changed_at: "2026-10-03T10:00:00Z" },
      { from_status: "en_preparacion", to_status: "enviado", changed_at: "2026-10-04T10:00:00Z" },
    ],
  },
  {
    id: 1, total: "780.00", status: "cancelado", created_at: "2026-10-01T10:00:00Z",
    items: [{ product_id: "khamrah", name: "Lattafa Khamrah", image: "/k.png", quantity: 2, unit_price: "390.00" }],
    history: [
      { from_status: null, to_status: "pagado", changed_at: "2026-10-01T10:00:00Z" },
      { from_status: "pagado", to_status: "cancelado", changed_at: "2026-10-01T12:00:00Z" },
    ],
  },
];

// respuestas de la API segun la URL
function apiFalsa(pedidos = PEDIDOS) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/user/7/orders")) return json({ success: true, orders: pedidos });
    if (url.endsWith("/user/7")) return json({ success: true, user: { id: 7, name: "María García", email: "maria@luxor.com", role: "CLIENTE" } });
    return json([]);
  });
}

function abrir() {
  localStorage.setItem("luxor-auth-user", JSON.stringify({ id: 7, name: "María García", email: "maria@luxor.com", role: "CLIENTE" }));
  return render(
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <MemoryRouter initialEntries={["/mi-cuenta"]}>
            <UserPage />
          </MemoryRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>
  );
}

const tarjeta = (id: number) => screen.getByRole("button", { name: new RegExp(`Pedido #${id}`) });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Mi cuenta: pedidos", () => {
  it("cada pedido muestra su estado con una etiqueta de color", async () => {
    apiFalsa();
    abrir();

    await screen.findByText("Pedido #2");
    expect(within(tarjeta(2)).getByText("Enviado")).toHaveClass("text-status-transit");
    expect(within(tarjeta(1)).getByText("Cancelado")).toHaveClass("text-status-error");
  });

  it("al abrir un pedido muestra productos, cantidades, precios, total y la fecha de cada cambio de estado", async () => {
    apiFalsa();
    const user = userEvent.setup();
    abrir();

    await screen.findByText("Pedido #2");
    expect(tarjeta(2)).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Lattafa Yara")).not.toBeInTheDocument();

    await user.click(tarjeta(2));

    expect(tarjeta(2)).toHaveAttribute("aria-expanded", "true");
    const detalle = document.getElementById(tarjeta(2).getAttribute("aria-controls")!)!;
    expect(within(detalle).getByText("Lattafa Yara")).toBeInTheDocument();
    expect(within(detalle).getByText("1 × Q330.00")).toBeInTheDocument();
    expect(within(detalle).getAllByText("Q330.00").length).toBeGreaterThanOrEqual(2); // subtotal y total
    const seguimiento = within(detalle).getAllByRole("listitem").slice(-3);
    expect(seguimiento.map((li) => li.querySelector("p")?.textContent)).toEqual(["Pagado", "En preparación", "Enviado"]);
    expect(seguimiento[2]).toHaveTextContent(/2026/);
  });

  it("se abre y se cierra con el teclado", async () => {
    apiFalsa();
    const user = userEvent.setup();
    abrir();

    await screen.findByText("Pedido #1");
    tarjeta(1).focus();
    await user.keyboard("{Enter}");
    expect(tarjeta(1)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("2 × Q390.00")).toBeInTheDocument();

    await user.keyboard(" ");
    expect(tarjeta(1)).toHaveAttribute("aria-expanded", "false");
  });

  it("el resumen no cuenta los pedidos cancelados", async () => {
    apiFalsa();
    abrir();

    await screen.findByText("Pedido #2");
    const pedidos = screen.getByText("Pedidos realizados").parentElement!;
    const total = screen.getByText("Total acumulado").parentElement!;
    expect(within(pedidos).getByText("1")).toBeInTheDocument();
    expect(within(total).getByText("Q330.00")).toBeInTheDocument();
    expect(screen.getByText("1 pedido cancelado no se cuenta.")).toBeInTheDocument();
  });

  it("pide los pedidos a la API cada vez que se abre la página (sin guardarlos)", async () => {
    const api = apiFalsa();
    const { unmount } = abrir();
    await screen.findByText("Pedido #2");
    unmount();

    const actualizados = [{ ...PEDIDOS[0], status: "entregado" }];
    api.mockRestore();
    apiFalsa(actualizados);
    abrir();

    expect(await screen.findByText("Entregado")).toBeInTheDocument();
  });
});
