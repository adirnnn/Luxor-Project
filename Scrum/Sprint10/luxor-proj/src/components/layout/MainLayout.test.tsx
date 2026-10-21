import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { MainLayout } from "./MainLayout";
import { AuthProvider } from "../../context/AuthContext";
import { CartProvider } from "../../context/CartContext";
import { SearchProvider } from "../../context/SearchContext";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

const montarEn = (ruta: string) =>
  render(
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <MainLayout>contenido</MainLayout>
          </MemoryRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>,
  );

const iconos = () => screen.queryByLabelText("Canales de contacto");

describe("MainLayout: WhatsApp, Instagram y chatbot flotantes", () => {
  it.each(["/", "/perfumes", "/producto/khamrah", "/cart"])("se muestran en %s", (ruta) => {
    montarEn(ruta);
    expect(iconos()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir asistente/i })).toBeInTheDocument();
  });

  it.each(["/admin", "/admin/nuevo", "/admin/editar/khamrah", "/admin/importar", "/reporte"])("no se muestran en %s", (ruta) => {
    montarEn(ruta);
    expect(iconos()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /abrir asistente/i })).not.toBeInTheDocument();
  });

  it("el enlace de WhatsApp apunta al número de soporte", () => {
    montarEn("/");
    expect(screen.getAllByRole("link", { name: "WhatsApp" })[0]).toHaveAttribute("href", "https://wa.me/50247143882");
  });
});
