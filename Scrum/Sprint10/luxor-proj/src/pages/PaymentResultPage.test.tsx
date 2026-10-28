// SFTWRKEY-445: vuelta desde la página de pago de Recurrente
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { SearchProvider } from "../context/SearchContext";
import PaymentResultPage from "./PaymentResultPage";
import PaymentCancelledPage from "./PaymentCancelledPage";
import { confirmPayment, cancelPayment } from "../services/checkoutService";

vi.mock("../services/checkoutService", () => ({ confirmPayment: vi.fn(), cancelPayment: vi.fn() }));
const confirmar = vi.mocked(confirmPayment);
const cancelar = vi.mocked(cancelPayment);

const REF = "11111111-2222-4333-8444-555555555555";

function abrir(path: string) {
  return render(
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/pago/resultado" element={<PaymentResultPage />} />
              <Route path="/pago/cancelado" element={<PaymentCancelledPage />} />
              <Route path="/compra-confirmada/:orderId" element={<p>Confirmación del pedido</p>} />
              <Route path="/cart" element={<p>Carrito</p>} />
            </Routes>
          </MemoryRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>
  );
}

const pagado = (guest: boolean) => ({
  status: "pagado" as const,
  guest,
  order: { id: 42, total: 780, created_at: "2026-10-28", items: [{ name: "Lattafa Khamrah", quantity: 2, price: 390 }] },
  payment: { brand: "VISA", last4: "4242" },
});

beforeEach(() => {
  confirmar.mockReset();
  cancelar.mockReset();
});

describe("PaymentResultPage", () => {
  it("el invitado ve su comprobante con número de pedido, total y tarjeta", async () => {
    confirmar.mockResolvedValue(pagado(true));
    abrir(`/pago/resultado?ref=${REF}`);

    expect(await screen.findByText("#42")).toBeInTheDocument();
    expect(screen.getByText("Lattafa Khamrah × 2")).toBeInTheDocument();
    expect(screen.getByText(/VISA •••• 4242/)).toBeInTheDocument();
    expect(confirmar).toHaveBeenCalledWith(REF);
  });

  it("con cuenta pasa a la confirmación del pedido", async () => {
    confirmar.mockResolvedValue(pagado(false));
    abrir(`/pago/resultado?ref=${REF}`);

    expect(await screen.findByText("Confirmación del pedido")).toBeInTheDocument();
  });

  it("un pago cancelado explica que no hubo cobro ni pedido", async () => {
    confirmar.mockResolvedValue({ status: "cancelado", failureReason: "Fondos insuficientes" });
    abrir(`/pago/resultado?ref=${REF}`);

    expect(await screen.findByText(/Motivo: Fondos insuficientes/)).toBeInTheDocument();
    expect(screen.getByText(/No se hizo ningún cobro/)).toBeInTheDocument();
  });

  it("sin referencia regresa al carrito", () => {
    abrir("/pago/resultado");
    expect(screen.getByText("Carrito")).toBeInTheDocument();
    expect(confirmar).not.toHaveBeenCalled();
  });
});

describe("PaymentCancelledPage", () => {
  it("libera el pago y muestra el motivo del rechazo", async () => {
    cancelar.mockResolvedValue({ status: "cancelado", failureReason: "Tarjeta rechazada" });
    abrir(`/pago/cancelado?ref=${REF}`);

    expect(await screen.findByText(/Motivo: Tarjeta rechazada/)).toBeInTheDocument();
    expect(cancelar).toHaveBeenCalledWith(REF);
  });

  it("si en realidad sí pagó, lo manda al resultado", async () => {
    cancelar.mockResolvedValue(pagado(true));
    confirmar.mockResolvedValue(pagado(true));
    abrir(`/pago/cancelado?ref=${REF}`);

    expect(await screen.findByText("#42")).toBeInTheDocument();
  });
});
