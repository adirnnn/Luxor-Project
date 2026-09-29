import type { ReactNode } from "react";
import clsx from "clsx";
import { Chatbot } from "../../features/chatbot/Chatbot";
import { Navbar } from "./Navbar";
import { SOCIAL_LINKS } from "./SocialLinks";

type Props = {
  children: ReactNode;
  fullBleed?: boolean;
};

export const MainLayout = ({ children, fullBleed = false }: Props) => (
  <div className="min-h-screen flex flex-col bg-primary-black">
    <Navbar />
    <main className={clsx("flex-1 pb-24 md:pb-16", !fullBleed && "pt-32 md:pt-40")}>{children}</main>
    <div className="floating-social" aria-label="Canales de contacto">
      {/* En mobile WhatsApp/Instagram viven en el menú de la navbar para que solo flote el chatbot. */}
      <div className="hidden md:flex md:flex-col md:gap-3">
        {SOCIAL_LINKS.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="social-bubble" aria-label={link.label}>
            {link.icon}
          </a>
        ))}
      </div>
      <Chatbot />
    </div>
  </div>
);
