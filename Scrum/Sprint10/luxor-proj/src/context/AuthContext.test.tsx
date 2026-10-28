// SFTWRKEY-451: la sesión va en una cookie httpOnly; en localStorage solo quedan nombre y rol.
import { act, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const ANA = { id: 7, name: "Ana", email: "ana@luxor.com", role: "CLIENTE" };

function Sesion() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="usuario">{user ? user.name : "visitante"}</p>
      <button onClick={() => login(ANA)}>Entrar</button>
      <button onClick={logout}>Salir</button>
    </div>
  );
}

const responder = (status: number, body: unknown = {}) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AuthContext con la sesión en cookie", () => {
  it("al entrar guarda solo los datos públicos: el token nunca toca localStorage", async () => {
    responder(200);
    render(<AuthProvider><Sesion /></AuthProvider>);

    await act(async () => screen.getByText("Entrar").click());

    expect(screen.getByTestId("usuario")).toHaveTextContent("Ana");
    expect(localStorage.getItem("luxor-auth-token")).toBeNull();
    expect(JSON.parse(localStorage.getItem("luxor-auth-user")!)).toEqual(ANA);
    expect(Object.values(localStorage).join(" ")).not.toMatch(/eyJ/); // ningún JWT guardado
  });

  it("borra el token que guardaba la versión anterior del sitio", () => {
    localStorage.setItem("luxor-auth-token", "eyJ.token.viejo");
    responder(200, { success: true, user: ANA });

    render(<AuthProvider><Sesion /></AuthProvider>);

    expect(localStorage.getItem("luxor-auth-token")).toBeNull();
  });

  it("al abrir el sitio con sesión guardada pregunta a /api/me y actualiza los datos", async () => {
    localStorage.setItem("luxor-auth-user", JSON.stringify({ ...ANA, name: "Ana Vieja" }));
    const fetchMock = responder(200, { success: true, user: { ...ANA, name: "Ana Nueva" } });

    render(<AuthProvider><Sesion /></AuthProvider>);

    expect(await screen.findByText("Ana Nueva")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/me");
    expect(JSON.parse(localStorage.getItem("luxor-auth-user")!).name).toBe("Ana Nueva");
  });

  it("si la cookie ya venció (/api/me responde 401) cierra la sesión", async () => {
    localStorage.setItem("luxor-auth-user", JSON.stringify(ANA));
    responder(401, { success: false });

    render(<AuthProvider><Sesion /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("usuario")).toHaveTextContent("visitante"));
    expect(localStorage.getItem("luxor-auth-user")).toBeNull();
  });

  it("sin conexión mantiene la sesión como estaba", async () => {
    localStorage.setItem("luxor-auth-user", JSON.stringify(ANA));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    render(<AuthProvider><Sesion /></AuthProvider>);

    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("usuario")).toHaveTextContent("Ana");
  });

  it("un visitante sin sesión no consulta /api/me", () => {
    const fetchMock = responder(401);

    render(<AuthProvider><Sesion /></AuthProvider>);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("usuario")).toHaveTextContent("visitante");
  });

  it("al salir pide al backend que borre la cookie (JavaScript no puede borrarla)", async () => {
    localStorage.setItem("luxor-auth-user", JSON.stringify(ANA));
    const fetchMock = responder(200, { success: true, user: ANA });
    render(<AuthProvider><Sesion /></AuthProvider>);

    await act(async () => screen.getByText("Salir").click());

    expect(screen.getByTestId("usuario")).toHaveTextContent("visitante");
    expect(localStorage.getItem("luxor-auth-user")).toBeNull();
    const salir = fetchMock.mock.calls.find(([url]) => String(url) === "/api/logout");
    expect(salir?.[1]).toMatchObject({ method: "POST" });
  });
});
