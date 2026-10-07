import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import { Chatbot } from "../../features/chatbot/Chatbot";
import { Navbar } from "./Navbar";
import { SOCIAL_LINKS } from "./SocialLinks";

type Props = {
  children: ReactNode;
  fullBleed?: boolean;
};

// En el panel de administración y el reporte no se muestran WhatsApp, Instagram ni el chatbot.
const RUTAS_SIN_CONTACTO = ["/admin", "/reporte"];

export const MainLayout = ({ children, fullBleed = false }: Props) => {
  const { pathname } = useLocation();
  const esAdmin = RUTAS_SIN_CONTACTO.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));

  return (
  <div className="min-h-screen flex flex-col bg-primary-black">
    <Navbar />
    <main className={clsx("flex-1 pb-24 md:pb-16", !fullBleed && "pt-32 md:pt-40")}>{children}</main>
    {!esAdmin && <div className="floating-social" aria-label="Canales de contacto">
      {/* En mobile WhatsApp/Instagram viven en el menú de la navbar para que solo flote el chatbot. */}
      <div className="hidden md:flex md:flex-col md:gap-3">
        {SOCIAL_LINKS.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="social-bubble" aria-label={link.label}>
            {link.icon}
          </a>
        ))}
      </div>
      <Chatbot />
    </div>}
  </div>
  );
};
