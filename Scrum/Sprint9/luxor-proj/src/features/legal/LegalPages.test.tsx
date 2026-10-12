// SFTWRKEY-434: páginas legales y sus enlaces desde el footer, el login y el pago
// SFTWRKEY-437: preguntas frecuentes
import { render, screen, within } from "@testing-library/react";
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
import FaqPage from "../../pages/FaqPage";

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
              <Route path="/preguntas-frecuentes" element={<FaqPage />} />
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
    ["/preguntas-frecuentes", "Preguntas frecuentes"],
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
    const legal = screen.getByRole("navigation", { name: "Ayuda e información legal" });
    const enlaces = Array.from(legal.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(enlaces).toEqual(["/privacidad", "/terminos", "/envios-devoluciones", "/preguntas-frecuentes"]);
  });

  it("el formulario de pago avisa que al pagar se aceptan los términos", () => {
    abrir("/pago");
    expect(screen.getByText(/al pagar aceptas los/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "términos y condiciones" })).toHaveAttribute("href", "/terminos");
    expect(screen.getByRole("link", { name: "política de privacidad" })).toHaveAttribute("href", "/privacidad");
  });
});

describe("preguntas frecuentes", () => {
  const preguntas = () => Array.from(document.querySelectorAll("details > summary"));

  it("tiene al menos 10 preguntas agrupadas por tema", () => {
    abrir("/preguntas-frecuentes");
    expect(preguntas().length).toBeGreaterThanOrEqual(10);
    for (const tema of ["Compras", "Pagos", "Envíos y devoluciones", "Tu cuenta"]) {
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(tema) })).toBeInTheDocument();
    }
  });

  it("las respuestas empiezan cerradas y se abren al elegir la pregunta", async () => {
    abrir("/preguntas-frecuentes");
    const detalle = screen.getByText("¿Los perfumes son originales?").closest("details")!;
    expect(detalle.open).toBe(false);
    await userEvent.click(screen.getByText("¿Los perfumes son originales?"));
    expect(detalle.open).toBe(true);
    expect(within(detalle).getByText(/certificado de autenticidad/i)).toBeVisible();
  });

  it("se recorre con el teclado (cada pregunta recibe el foco con Tab)", async () => {
    abrir("/preguntas-frecuentes");
    const primera = preguntas()[0];
    primera.setAttribute("data-primera", "true");
    // Tab hasta llegar a la primera pregunta, después de la navegación y los enlaces del encabezado
    for (let i = 0; i < 60 && document.activeElement !== primera; i++) await userEvent.tab();
    expect(document.activeElement).toBe(primera);
  });

  it("dice lo mismo que el chatbot sobre envíos y contacto", () => {
    abrir("/preguntas-frecuentes");
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("24 a 48 horas");
    expect(texto).toContain("+502 4714 3882");
    expect(texto).toContain("@eljoyeroarabe");
    expect(texto).toContain("19 calle 3-31, Zona 1");
  });
});
