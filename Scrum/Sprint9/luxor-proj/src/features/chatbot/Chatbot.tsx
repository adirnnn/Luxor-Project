import { useState } from "react";
import { sendMessage, type ChatHistoryMessage } from "../../services/chatbotService";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// error: mensajes de fallo de conexión, que no se mandan como historial.
interface Message { sender: "user" | "bot"; text: string; error?: boolean; }

// SFTWRKEY-393: mensajes previos que se envían para entender seguimientos ("¿y cuánto cuesta?").
const MAX_HISTORIAL = 8;
const BIENVENIDA = "¡Hola! Soy el asistente de Perfumería Victoria, ¿en qué te puedo ayudar?";
const SUGERENCIAS = ["Recomiéndame un perfume", "Perfumes dulces", "¿Cómo son los envíos?"];

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend(texto = input) {
    const text = texto.trim();
    if (!text || loading) return;
    const history: ChatHistoryMessage[] = messages
      .filter((message) => !message.error)
      .slice(-MAX_HISTORIAL)
      .map((message) => ({ role: message.sender === "user" ? "user" : "assistant", content: message.text }));
    setMessages((previous) => [...previous, { sender: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const response = await sendMessage({ message: text, history });
      setMessages((previous) => [...previous, { sender: "bot", text: response.response }]);
    } catch {
      setMessages((previous) => [...previous, { sender: "bot", text: "No fue posible contactar con el asistente.", error: true }]);
    } finally { setLoading(false); }
  }


return (
  <>
    {/* 1. BOTÓN FLOTANTE DEL CHATBOT */}
    <button
      onClick={() => setIsOpen((open) => !open)}
      className="social-bubble !bg-primary-gold !text-primary-black hover:!bg-primary-champagne"
      aria-label="Abrir asistente Victoria"
      aria-expanded={isOpen}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="6" width="16" height="13" rx="4" />
        <path d="M9 6V4h6v2M8.5 12h.01M15.5 12h.01M9 15h6" />
      </svg>
    </button>

    {/* 2. VENTANA PRINCIPAL DEL CHATBOT */}
    {isOpen && (
      <section
        className="fixed bottom-24 right-5 z-[110] flex h-[min(32rem,calc(100dvh-8rem))] w-[min(22.5rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-primary-gold/20 bg-primary-black shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        aria-label="Asistente Victoria"
      >

        {/* 3. ENCABEZADO */}
        <header className="flex items-center justify-between bg-primary-gold px-5 py-4 text-primary-black">
          <div>
            <p className="font-heading text-lg uppercase tracking-wide">
              Asistente Victoria
            </p>

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
              Asistente de fragancias
            </p>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none transition hover:bg-primary-black/10"
            aria-label="Cerrar asistente"
          >
            ×
          </button>
        </header>

        {/* 4. ÁREA DE MENSAJES */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-primary-black/95 p-4">

          {/* Mensaje de bienvenida y sugerencias */}
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="rounded-2xl bg-white/[0.06] p-3 text-sm text-primary-champagne/70">
                {BIENVENIDA}
              </p>

              <div className="flex flex-wrap gap-2">
                {SUGERENCIAS.map((sugerencia) => (
                  <button
                    key={sugerencia}
                    type="button"
                    onClick={() => void handleSend(sugerencia)}
                    className="min-h-11 rounded-full border border-primary-gold/30 px-3 text-xs font-bold text-primary-champagne transition hover:bg-primary-gold hover:text-primary-black"
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Historial de mensajes */}
          {messages.map((message, index) => (
            <div
              key={`${message.sender}-${index}`}
              className={`flex ${
                message.sender === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`min-w-0 max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                  message.sender === "user"
                    ? "bg-primary-gold text-primary-black"
                    : "bg-white/[0.08] text-primary-champagne"
                }`}
              >
                {/* Markdown únicamente para respuestas del chatbot */}
                {message.sender === "bot" && !message.error ? (
                  <div className="chatbot-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">
                    {message.text}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Indicador de respuesta */}
          {loading && (
            <p className="text-sm italic text-primary-champagne/50">
              Pensando...
            </p>
          )}
        </div>

        {/* 5. CAMPO PARA ESCRIBIR MENSAJES */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
          className="flex gap-2 border-t border-white/10 p-3"
        >
          <input
            value={input}
            maxLength={500}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escribe un mensaje..."
            className="min-w-0 flex-1 rounded-xl bg-white/[0.08] px-3 py-3 text-base text-primary-champagne outline-none placeholder:text-primary-champagne/35 focus:ring-1 focus:ring-primary-gold"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="min-h-11 rounded-xl bg-primary-gold px-4 text-sm font-bold text-primary-black transition hover:bg-primary-champagne disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </section>
    )}
  </>
);

}
