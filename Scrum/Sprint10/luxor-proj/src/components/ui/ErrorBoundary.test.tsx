// Si una parte de la página da error, se ve un aviso para recargar en vez de la pantalla negra
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function SeCae(): never {
  throw new Error("falló al dibujar");
}

afterEach(() => vi.restoreAllMocks());

describe("ErrorBoundary", () => {
  it("muestra la página normal cuando no hay errores", () => {
    render(<ErrorBoundary><p>contenido</p></ErrorBoundary>);
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("si algo da error muestra el aviso con el botón para recargar y el enlace al inicio", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const recargar = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: recargar });

    render(<ErrorBoundary><SeCae /></ErrorBoundary>);

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos mostrar esta página");
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    await userEvent.click(screen.getByRole("button", { name: "Recargar la página" }));
    expect(recargar).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
