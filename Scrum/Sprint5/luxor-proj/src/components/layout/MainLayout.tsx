import type { ReactNode } from "react";
import { Chatbot } from "../../features/chatbot/Chatbot";
import { Navbar } from "./Navbar";

type Props = { children: ReactNode };

export const MainLayout = ({ children }: Props) => (
  <div className="min-h-screen flex flex-col bg-primary-black">
    <Navbar />
    <main className="flex-1 pb-16">{children}</main>
    <div className="floating-social" aria-label="Canales de contacto">
      <a href="https://wa.me/50240000000" target="_blank" rel="noreferrer" className="social-bubble" aria-label="WhatsApp">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
      </a>
      <a href="https://www.instagram.com/eljoyeroarabe/" target="_blank" rel="noreferrer" className="social-bubble" aria-label="Instagram">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
      </a>
      <Chatbot />
    </div>
  </div>
);
