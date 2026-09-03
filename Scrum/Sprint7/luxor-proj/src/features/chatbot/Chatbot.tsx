import { useState } from "react";
import { sendMessage } from "../../services/chatbotService";

interface Message { sender: "user" | "bot"; text: string; }

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((previous) => [...previous, { sender: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const response = await sendMessage({ message: text });
      setMessages((previous) => [...previous, { sender: "bot", text: response.response }]);
    } catch {
      setMessages((previous) => [...previous, { sender: "bot", text: "No fue posible contactar con el asistente." }]);
    } finally { setLoading(false); }
  }

  return <>
    <button onClick={() => setIsOpen((open) => !open)} className="social-bubble !bg-primary-gold !text-primary-black hover:!bg-primary-champagne" aria-label="Abrir asistente Habibi" aria-expanded={isOpen}>
      <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="16" height="13" rx="4" /><path d="M9 6V4h6v2M8.5 12h.01M15.5 12h.01M9 15h6" /></svg>
    </button>
    {isOpen && <section className="fixed bottom-24 right-5 z-[110] flex h-[min(32rem,calc(100dvh-8rem))] w-[min(22.5rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-primary-gold/20 bg-primary-black shadow-[0_24px_80px_rgba(0,0,0,0.55)]" aria-label="Asistente Habibi">
      <header className="flex items-center justify-between bg-primary-gold px-5 py-4 text-primary-black"><div><p className="font-heading text-lg uppercase tracking-wide">Habibi Assistant</p><p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Asistente de fragancias</p></div><button onClick={() => setIsOpen(false)} className="rounded-full p-2 transition hover:bg-primary-black/10" aria-label="Cerrar asistente">×</button></header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-primary-black/95 p-4">{messages.length === 0 && <p className="rounded-2xl bg-white/[0.06] p-3 text-sm text-primary-champagne/70">¿Buscas una fragancia? Cuéntame qué notas te gustan.</p>}{messages.map((message, index) => <div key={`${message.sender}-${index}`} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${message.sender === "user" ? "bg-primary-gold text-primary-black" : "bg-white/[0.08] text-primary-champagne"}`}>{message.text}</p></div>)}{loading && <p className="text-sm italic text-primary-champagne/50">Pensando...</p>}</div>
      <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="flex gap-2 border-t border-white/10 p-3"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escribe un mensaje..." className="min-w-0 flex-1 rounded-xl bg-white/[0.08] px-3 py-2 text-sm text-primary-champagne outline-none placeholder:text-primary-champagne/35 focus:ring-1 focus:ring-primary-gold" /><button type="submit" disabled={loading || !input.trim()} className="rounded-xl bg-primary-gold px-4 text-sm font-bold text-primary-black transition hover:bg-primary-champagne disabled:cursor-not-allowed disabled:opacity-50">Enviar</button></form>
    </section>}
  </>;
}
