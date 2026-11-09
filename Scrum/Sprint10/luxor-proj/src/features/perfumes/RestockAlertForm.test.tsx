// SFTWRKEY-450: "Avísame cuando vuelva" para perfumes agotados
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { ProductDetail } from "./ProductDetail";
import RestockUnsubscribePage from "../../pages/RestockUnsubscribePage";
import { subscribeRestockAlert, unsubscribeRestockAlerts } from "../../services/restockAlertService";

vi.mock("../../services/restockAlertService", () => ({
  subscribeRestockAlert: vi.fn(),
  unsubscribeRestockAlerts: vi.fn(),
}));
const suscribir = vi.mocked(subscribeRestockAlert);
const cancelar = vi.mocked(unsubscribeRestockAlerts);

const NOTAS = { salida: "Canela", corazon: "Dátil", fondo: "Vainilla" };

function ficha(stock: number) {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <ProductDetail id="khamrah" name="Lattafa Khamrah" price={650} image="/k.webp" description="Dulce" notes={NOTAS} stock={stock} />
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => {
  suscribir.mockReset();
  cancelar.mockReset();
  localStorage.clear();
});

describe("Avísame cuando vuelva", () => {
  it("solo aparece cuando el perfume está agotado", () => {
    const { unmount } = ficha(5);
    expect(screen.queryByRole("button", { name: /Avísame cuando vuelva/ })).not.toBeInTheDocument();
    unmount();

    ficha(0);
    expect(screen.getByRole("button", { name: /Avísame cuando vuelva/ })).toBeInTheDocument();
  });

  it("sin marcar el consentimiento no se manda el correo", async () => {
    const user = userEvent.setup();
    ficha(0);

    await user.click(screen.getByRole("button", { name: /Avísame cuando vuelva/ }));
    await user.type(screen.getByLabelText("Tu correo"), "ana@correo.com");
    await user.click(screen.getByRole("button", { name: "Avisarme" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Marca la casilla/);
    expect(suscribir).not.toHaveBeenCalled();
  });

  it("con correo y consentimiento guarda el aviso y lo confirma", async () => {
    suscribir.mockResolvedValue({ success: true, message: "Listo. Te escribiremos una sola vez a ese correo cuando este perfume vuelva." });
    const user = userEvent.setup();
    ficha(0);

    await user.click(screen.getByRole("button", { name: /Avísame cuando vuelva/ }));
    await user.type(screen.getByLabelText("Tu correo"), "ana@correo.com");
    await user.click(screen.getByRole("checkbox", { name: /Acepto recibir un correo/ }));
    await user.click(screen.getByRole("button", { name: "Avisarme" }));

    expect(suscribir).toHaveBeenCalledWith("khamrah", "ana@correo.com", true);
    expect(await screen.findByRole("status")).toHaveTextContent(/una sola vez/);
  });

  it("un correo inválido se avisa antes de llamar al servidor", async () => {
    const user = userEvent.setup();
    ficha(0);

    await user.click(screen.getByRole("button", { name: /Avísame cuando vuelva/ }));
    await user.type(screen.getByLabelText("Tu correo"), "no-es-correo");
    await user.click(screen.getByRole("checkbox", { name: /Acepto recibir un correo/ }));
    await user.click(screen.getByRole("button", { name: "Avisarme" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Ingresa un correo válido.");
    expect(suscribir).not.toHaveBeenCalled();
  });

  it("muestra el mensaje del servidor si no se pudo guardar", async () => {
    suscribir.mockResolvedValue({ success: false, message: "Demasiados intentos. Intenta de nuevo más tarde." });
    const user = userEvent.setup();
    ficha(0);

    await user.click(screen.getByRole("button", { name: /Avísame cuando vuelva/ }));
    await user.type(screen.getByLabelText("Tu correo"), "ana@correo.com");
    await user.click(screen.getByRole("checkbox", { name: /Acepto recibir un correo/ }));
    await user.click(screen.getByRole("button", { name: "Avisarme" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos");
  });

  it("con sesión el correo ya viene lleno", async () => {
    localStorage.setItem("luxor-auth-user", JSON.stringify({ id: 3, name: "Ana", email: "ana@correo.com", role: "USER" }));
    const user = userEvent.setup();
    ficha(0);

    await user.click(screen.getByRole("button", { name: /Avísame cuando vuelva/ }));
    expect(screen.getByLabelText("Tu correo")).toHaveValue("ana@correo.com");
  });
});

describe("Cancelar avisos", () => {
  const abrir = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/avisos/cancelar" element={<RestockUnsubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );

  it("un enlace inválido no deja cancelar", () => {
    abrir("/avisos/cancelar?token=abc");
    expect(screen.getByText("Enlace inválido")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("con el enlace del correo cancela los avisos al confirmar", async () => {
    cancelar.mockResolvedValue({ success: true, message: "Listo. Ya no te enviaremos avisos de perfumes agotados." });
    const token = "b".repeat(64);
    const user = userEvent.setup();
    abrir(`/avisos/cancelar?token=${token}`);

    // no se cancela solo al abrir la página
    expect(cancelar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "No recibir más avisos" }));

    expect(cancelar).toHaveBeenCalledWith(token);
    expect(await screen.findByText(/Ya no te enviaremos avisos/)).toBeInTheDocument();
  });
});
