import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

type Props = {
  children: ReactNode;
};

export const MainLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen flex flex-col bg-primary-black">
      <Navbar />

      <main className="flex-1 pb-16">{children}</main>

      <footer 
        id="contacto"
        className="bg-primary-black px-6 py-12 text-primary-champagne/60 mt-auto"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-3 text-sm">
          
          {/* Marca */}
          <div className="flex flex-col gap-3">
            <h3 className="text-primary-gold font-heading text-[13px] tracking-[0.2em] uppercase font-bold">Habibi Parfums</h3>
            <p className="leading-relaxed text-[12px] text-primary-champagne/50">
              Liquid Jewelry. Perfumes árabes auténticos curados con criterio y sofisticación por El Joyero Arabe.
            </p>
          </div>

          {/* Ubicaciones */}
          <div className="flex flex-col gap-3">
            <h3 className="text-primary-gold font-heading text-[13px] tracking-[0.2em] uppercase font-bold">Nuestras Boutiques</h3>
            <ul className="space-y-3 text-[12px]">
              <li className="flex flex-col gap-0.5">
                <span className="font-semibold text-primary-champagne/80">📍 Joyería Victoria - Metro Centro</span>
                <span className="text-[11px] text-primary-champagne/45">
                  19 calle 3-31, Zona 1
                </span>
              </li>
              <li className="flex flex-col gap-0.5">
                <span className="font-semibold text-primary-champagne/80">📍 Joyería Glamour - C.C. El Pueblito</span>
                <span className="text-[11px] text-primary-champagne/45">
                  Zona 1
                </span>
              </li>
              <li className="flex flex-col gap-0.5">
                <span className="font-semibold text-primary-champagne/80">📍 Joyería Luxor - C.C. San Isidro</span>
                <span className="text-[11px] text-primary-champagne/45">
                  Zona 16
                </span>
              </li>
            </ul>
          </div>

          {/* Contacto / redes */}
          <div className="flex flex-col gap-4">
            <h3 className="text-primary-gold font-heading text-[13px] tracking-[0.2em] uppercase font-bold">Contacto</h3>
            <div className="flex items-center gap-4">
              {/* Instagram Bubble */}
              <a 
                href="https://www.instagram.com/eljoyeroarabe/" 
                target="_blank" 
                rel="noreferrer"
                className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-primary-gold hover:bg-primary-gold hover:text-primary-black transition-all hover:scale-110 shadow-lg shadow-primary-gold/10 hover:shadow-primary-gold/30"
                aria-label="Instagram"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>

              {/* WhatsApp Bubble */}
              <a 
                href="https://wa.me/50240000000" 
                target="_blank" 
                rel="noreferrer"
                className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-primary-gold hover:bg-primary-gold hover:text-primary-black transition-all hover:scale-110 shadow-lg shadow-primary-gold/10 hover:shadow-primary-gold/30"
                aria-label="WhatsApp"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </a>
            </div>
            <p className="text-[11px] text-primary-champagne/45 italic mt-2">
              Envíos a todo el país.
            </p>
          </div>
        </div>

        {/* Línea inferior */}
        <div className="mt-12 border-t border-white/[0.06] pt-6 text-center text-[10px] tracking-wider text-primary-champagne/40">
          © {new Date().getFullYear()} Habibi Parfums. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};