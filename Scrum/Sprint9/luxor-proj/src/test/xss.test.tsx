// SFTWRKEY-379: XSS (OWASP A05). El texto con HTML que venga de la base o del chatbot
// debe mostrarse literal y nunca crear elementos ni ejecutar scripts.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { ProductCard } from "../features/perfumes/ProductCard";
import { ProductDetail } from "../features/perfumes/ProductDetail";
import { Chatbot } from "../features/chatbot/Chatbot";

vi.mock("../services/chatbotService", () => ({
  sendMessage: vi.fn(async () => ({ response: "<img src=x onerror=\"window.__xss = true\">" })),
}));

const SCRIPT = "<script>window.__xss = true</script>";
const IMG = "<img src=x onerror=\"window.__xss = true\">";

declare global {
  interface Window { __xss?: boolean }
}

beforeEach(() => {
  window.__xss = false;
});

describe("XSS almacenado", () => {
  it("ProductCard muestra el nombre y la descripción con HTML como texto", () => {
    const { container } = render(
      <MemoryRouter>
        <ProductCard id="xss" name={SCRIPT} price={10} image="/images/x.png" description={IMG} />
      </MemoryRouter>,
    );

    expect(screen.getByText(SCRIPT)).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelectorAll("img[onerror]")).toHaveLength(0);
    expect(window.__xss).toBe(false);
  });

  it("ProductDetail muestra el nombre, la descripción y las notas con HTML como texto", () => {
    const { container } = render(
      <ProductDetail
        id="xss"
        name={SCRIPT}
        price={10}
        image="/images/x.png"
        description={IMG}
        notes={{ salida: SCRIPT, corazon: IMG, fondo: "normal" }}
      />,
    );

    expect(screen.getAllByText(SCRIPT).length).toBeGreaterThan(0);
    expect(screen.getAllByText(IMG).length).toBeGreaterThan(0);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelectorAll("img[onerror]")).toHaveLength(0);
    expect(window.__xss).toBe(false);
  });

  it("el chatbot muestra una respuesta con HTML como texto", async () => {
    const user = userEvent.setup();
    const { container } = render(<Chatbot />);

    await user.click(screen.getByRole("button", { name: /abrir asistente/i }));
    await user.type(screen.getByPlaceholderText(/escribe un mensaje/i), "hola{Enter}");

    expect(await screen.findByText(IMG)).toBeInTheDocument();
    expect(container.querySelectorAll("img[onerror]")).toHaveLength(0);
    expect(window.__xss).toBe(false);
  });
});
