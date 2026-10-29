// Feedback del cliente: si la sesión del admin vence con el panel abierto, se avisa en vez de
// mostrar listas vacías.
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { SessionExpiredNotice } from "../components/auth/SessionExpiredNotice";

const ADMIN = { id: 1, name: "Admin", email: "admin@luxor.com", role: "ADMIN" };

function Estado() {
  const { user } = useAuth();
  return <p>{user ? `con sesión: ${user.name}` : "sin sesión"}</p>;
}

function abrir() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/admin"]}>
        <SessionExpiredNotice />
        <Estado />
      </MemoryRouter>
    </AuthProvider>
  );
}

const respuesta = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  localStorage.setItem("luxor-auth-user", JSON.stringify(ADMIN));
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("sesión vencida", () => {
  it("si una petición a la API responde 401, cierra la sesión y avisa", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockImplementation(async (input) =>
      String(input).endsWith("/me") ? respuesta(200, { user: ADMIN }) : respuesta(401)
    );
    abrir();
    expect(await screen.findByText("con sesión: Admin")).toBeInTheDocument();

    await act(async () => {
      await window.fetch("/api/admin/security-alerts");
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Tu sesión expiró");
    expect(screen.getByText("sin sesión")).toBeInTheDocument();
    expect(localStorage.getItem("luxor-auth-user")).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("si /me responde 401 al volver a la pestaña, también avisa", async () => {
    let vigente = true;
    vi.spyOn(window, "fetch").mockImplementation(async () => (vigente ? respuesta(200, { user: ADMIN }) : respuesta(401)));
    abrir();
    expect(await screen.findByText("con sesión: Admin")).toBeInTheDocument();

    vigente = false;
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Tu sesión expiró");
  });

  it("un 401 del login (contraseña incorrecta) no se toma como sesión vencida", async () => {
    vi.spyOn(window, "fetch").mockImplementation(async (input) =>
      String(input).endsWith("/me") ? respuesta(200, { user: ADMIN }) : respuesta(401)
    );
    abrir();
    expect(await screen.findByText("con sesión: Admin")).toBeInTheDocument();

    await act(async () => {
      await window.fetch("/api/login", { method: "POST" });
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("con sesión: Admin")).toBeInTheDocument();
  });
});
