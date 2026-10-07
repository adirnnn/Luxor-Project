// SFTWRKEY-393: bienvenida, sugerencias e historial del chatbot.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Chatbot } from "./Chatbot";
import { sendMessage } from "../../services/chatbotService";

vi.mock("../../services/chatbotService", () => ({ sendMessage: vi.fn() }));
const enviar = vi.mocked(sendMessage);

async function abrir() {
  const user = userEvent.setup();
  render(<Chatbot />);
  await user.click(screen.getByRole("button", { name: /abrir asistente/i }));
  return user;
}

beforeEach(() => enviar.mockReset());

describe("Chatbot", () => {
  it("muestra el mensaje de bienvenida de Perfumería Victoria", async () => {
    await abrir();
    expect(screen.getByText("¡Hola! Soy el asistente de Perfumería Victoria, ¿en qué te puedo ayudar?")).toBeInTheDocument();
  });

  it("una sugerencia envía su texto como mensaje", async () => {
    enviar.mockResolvedValue({ response: "Te recomiendo Khamrah." });
    const user = await abrir();
    await user.click(screen.getByRole("button", { name: "Perfumes dulces" }));

    expect(enviar).toHaveBeenCalledWith({ message: "Perfumes dulces", history: [] });
    expect(await screen.findByText("Te recomiendo Khamrah.")).toBeInTheDocument();
  });

  it("envía el historial de la conversación en los mensajes siguientes", async () => {
    enviar
      .mockResolvedValueOnce({ response: "Sí, tenemos Lattafa Khamrah." })
      .mockResolvedValueOnce({ response: "Cuesta Q390." });
    const user = await abrir();
    const caja = screen.getByPlaceholderText(/escribe un mensaje/i);

    await user.type(caja, "¿Tienen Khamrah?{Enter}");
    await screen.findByText("Sí, tenemos Lattafa Khamrah.");
    await user.type(caja, "¿y cuánto cuesta?{Enter}");
    await screen.findByText("Cuesta Q390.");

    expect(enviar).toHaveBeenLastCalledWith({
      message: "¿y cuánto cuesta?",
      history: [
        { role: "user", content: "¿Tienen Khamrah?" },
        { role: "assistant", content: "Sí, tenemos Lattafa Khamrah." },
      ],
    });
  });

  it("no manda como historial el mensaje de error de conexión", async () => {
    enviar.mockRejectedValueOnce(new Error("sin red")).mockResolvedValueOnce({ response: "¡Hola!" });
    const user = await abrir();
    const caja = screen.getByPlaceholderText(/escribe un mensaje/i);

    await user.type(caja, "hola{Enter}");
    await screen.findByText("No fue posible contactar con el asistente.");
    await user.type(caja, "hola otra vez{Enter}");
    await screen.findByText("¡Hola!");

    expect(enviar).toHaveBeenLastCalledWith({
      message: "hola otra vez",
      history: [{ role: "user", content: "hola" }],
    });
  });

  it("limita el mensaje a 500 caracteres, igual que el backend", async () => {
    await abrir();
    expect(screen.getByPlaceholderText(/escribe un mensaje/i)).toHaveAttribute("maxLength", "500");
  });
});
