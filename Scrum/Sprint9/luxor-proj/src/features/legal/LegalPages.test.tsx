// SFTWRKEY-434: páginas legales y sus enlaces desde el footer, el login y el pago
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { CartProvider } from "../../context/CartContext";
import { SearchProvider } from "../../context/SearchContext";
import { ContactFooter } from "../../components/layout/ContactFooter";
import { PaymentForm } from "../../validation/PaymentForm";
import PrivacyPage from "../../pages/PrivacyPage";
import TermsPage from "../../pages/TermsPage";
import ShippingReturnsPage from "../../pages/ShippingReturnsPage";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

const abrir = (ruta: string, extra: React.ReactNode = null) =>
  render(
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <Routes>
              <Route path="/" element={<ContactFooter />} />
              <Route path="/privacidad" element={<PrivacyPage />} />
              <Route path="/terminos" element={<TermsPage />} />
              <Route path="/envios-devoluciones" element={<ShippingReturnsPage />} />
              <Route path="/pago" element={<PaymentForm isProcessing={false} onValidSubmit={() => {}} />} />
            </Routes>
            {extra}
          </MemoryRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>,
  );

describe("páginas legales", () => {
  it.each([
    ["/privacidad", "Política de privacidad"],
    ["/terminos", "Términos y condiciones"],
    ["/envios-devoluciones", "Envíos y devoluciones"],
  ])("%s muestra su título y la fecha de actualización", (ruta, titulo) => {
    abrir(ruta);
    expect(screen.getByRole("heading", { level: 1, name: titulo })).toBeInTheDocument();
    expect(screen.getByText(/^última actualización:/i)).toBeInTheDocument();
  });

  it("la política de privacidad aclara que no se guarda el número completo de la tarjeta", () => {
    abrir("/privacidad");
    expect(screen.getByText(/nunca guardamos el número completo/i)).toBeInTheDocument();
  });

  it("se puede navegar entre las tres páginas", async () => {
    abrir("/privacidad");
    await userEvent.click(screen.getByRole("link", { name: "Envíos y devoluciones" }));
    expect(screen.getByRole("heading", { level: 1, name: "Envíos y devoluciones" })).toBeInTheDocument();
  });
});

describe("enlaces a las páginas legales", () => {
  it("el footer enlaza las tres páginas", () => {
    abrir("/");
    const legal = screen.getByRole("navigation", { name: "Información legal" });
    const enlaces = Array.from(legal.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(enlaces).toEqual(["/privacidad", "/terminos", "/envios-devoluciones"]);
  });

  it("el formulario de pago avisa que al pagar se aceptan los términos", () => {
    abrir("/pago");
    expect(screen.getByText(/al pagar aceptas los/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "términos y condiciones" })).toHaveAttribute("href", "/terminos");
    expect(screen.getByRole("link", { name: "política de privacidad" })).toHaveAttribute("href", "/privacidad");
  });
});
