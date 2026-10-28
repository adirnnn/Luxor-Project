// SFTWRKEY-419: vista de pedidos del admin
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { SearchProvider } from "../context/SearchContext";
import AdminOrdersPage from "./AdminOrdersPage";
import { fetchAdminOrder, fetchAdminOrders, updateOrderStatus } from "../services/orderService";
import type { AdminOrderDetail } from "../services/orderService";

vi.mock("../services/orderService", () => ({
  fetchAdminOrders: vi.fn(),
  fetchAdminOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
}));
const listar = vi.mocked(fetchAdminOrders);
const detalle = vi.mocked(fetchAdminOrder);
const actualizar = vi.mocked(updateOrderStatus);

const PEDIDOS = [
  { id: 12, created_at: "2026-10-05T10:00:00Z", total: 780, status: "pagado", is_guest: false, customer_name: "María García", customer_email: "maria@luxor.com", items_count: 2 },
  { id: 11, created_at: "2026-10-04T10:00:00Z", total: 390, status: "enviado", is_guest: true, customer_name: "Invitado · Pedro", customer_email: "pedro@test.com", items_count: 1 },
];

const detalleDe = (status: string, allowedNextStatuses: string[]): AdminOrderDetail => ({
  id: 12, created_at: "2026-10-05T10:00:00Z", total: 780, status, is_guest: false,
  customer_name: "María García", customer_email: "maria@luxor.com",
  // SFTWRKEY-449
  shipping: 0,
  delivery: { method: "envio", address: { billingAddress: "Zona 10, 5a avenida", city: "Guatemala", postalCode: "01010", country: "Guatemala" } },
  items: [{ product_id: "khamrah", name: "Lattafa Khamrah", image: null, quantity: 2, unit_price: 390, subtotal: 780 }],
  history: [{ from_status: null, to_status: "pagado", changed_at: "2026-10-05T10:00:00Z", changed_by_name: null }],
  allowedNextStatuses,
});

function abrir() {
  return render(
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <MemoryRouter initialEntries={["/admin/pedidos"]}>
            <AdminOrdersPage />
          </MemoryRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  listar.mockReset();
  detalle.mockReset();
  actualizar.mockReset();
  listar.mockResolvedValue({ orders: PEDIDOS, total: 2, page: 1, limit: 20 });
});
afterEach(() => { vi.restoreAllMocks(); });

describe("AdminOrdersPage", () => {
  it("muestra la tabla con número, cliente, fecha, total y estado", async () => {
    abrir();

    expect(await screen.findByText("#12")).toBeInTheDocument();
    const fila = screen.getByText("#12").closest("tr")!;
    expect(within(fila).getByText("María García")).toBeInTheDocument();
    expect(within(fila).getByText("Q780.00")).toBeInTheDocument();
    expect(within(fila).getByText("Pagado")).toHaveClass("text-status-info");

    const invitado = screen.getByText("#11").closest("tr")!;
    expect(within(invitado).getByText("Invitado · Pedro")).toBeInTheDocument();
    expect(within(invitado).getByText("Enviado")).toBeInTheDocument();
    expect(screen.getByText(/Página 1 de 1 · 2 pedidos/)).toBeInTheDocument();
    // SFTWRKEY-435: titulo propio y noindex como las demas paginas de admin
    expect(document.title).toMatch(/^Pedidos \|/);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  it("al filtrar por estado vuelve a pedir la lista con ese filtro y en la página 1", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("#12");

    await user.selectOptions(screen.getByLabelText("Estado"), "enviado");

    expect(listar).toHaveBeenLastCalledWith({ status: "enviado", from: "", to: "", page: 1, limit: 20 });
  });

  it("el selector del detalle solo ofrece los estados permitidos", async () => {
    detalle.mockResolvedValue(detalleDe("pagado", ["en_preparacion", "cancelado"]));
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByText("#12"));
    const dialogo = await screen.findByRole("dialog");
    await within(dialogo).findByText("Lattafa Khamrah");
    // SFTWRKEY-449: el admin ve a dónde enviar y el envío
    expect(within(dialogo).getByText("Zona 10, 5a avenida, Guatemala, 01010, Guatemala")).toBeInTheDocument();
    expect(within(dialogo).getByText("Gratis")).toBeInTheDocument();

    const opciones = within(within(dialogo).getByLabelText("Nuevo estado")).getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Selecciona el nuevo estado", "En preparación", "Cancelado"]);
  });

  it("un pedido entregado no ofrece cambios de estado", async () => {
    detalle.mockResolvedValue(detalleDe("entregado", []));
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByText("#12"));
    const dialogo = await screen.findByRole("dialog");
    expect(await within(dialogo).findByText(/ya no se puede cambiar/)).toBeInTheDocument();
    expect(within(dialogo).queryByLabelText("Nuevo estado")).not.toBeInTheDocument();
  });

  it("cancelar pide confirmación, avisa del stock y después actualiza la lista", async () => {
    detalle.mockResolvedValue(detalleDe("pagado", ["en_preparacion", "cancelado"]));
    actualizar.mockResolvedValue({});
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByText("#12"));
    const dialogo = await screen.findByRole("dialog");
    await user.selectOptions(await within(dialogo).findByLabelText("Nuevo estado"), "cancelado");
    expect(within(dialogo).getByText(/las 2 unidades de este pedido vuelven al stock/)).toBeInTheDocument();

    const llamadasAntes = listar.mock.calls.length;
    await user.click(within(dialogo).getByRole("button", { name: "Actualizar estado" }));

    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining("vuelven al stock"));
    expect(actualizar).toHaveBeenCalledWith(12, "cancelado");
    expect(await within(dialogo).findByText(/Estado actualizado a "Cancelado"/)).toBeInTheDocument();
    expect(listar.mock.calls.length).toBeGreaterThan(llamadasAntes);
  });

  it("si no se confirma la cancelación no se cambia nada", async () => {
    detalle.mockResolvedValue(detalleDe("pagado", ["en_preparacion", "cancelado"]));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByText("#12"));
    const dialogo = await screen.findByRole("dialog");
    await user.selectOptions(await within(dialogo).findByLabelText("Nuevo estado"), "cancelado");
    await user.click(within(dialogo).getByRole("button", { name: "Actualizar estado" }));

    expect(actualizar).not.toHaveBeenCalled();
  });

  it("si la API falla muestra el error y permite reintentar", async () => {
    listar.mockImplementation(async () => { throw new Error("No se pudieron obtener los pedidos."); });
    const user = userEvent.setup();
    abrir();

    expect(await screen.findByText("No se pudieron obtener los pedidos.")).toBeInTheDocument();
    listar.mockResolvedValue({ orders: PEDIDOS, total: 2, page: 1, limit: 20 });
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("#12")).toBeInTheDocument();
  });
});
