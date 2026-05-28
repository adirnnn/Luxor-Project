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

      {/* Floating Socials */}
      <div className="floating-social">
        <a 
          href="https://wa.me/50240000000" 
          target="_blank" 
          rel="noreferrer"
          className="social-bubble"
          aria-label="WhatsApp"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
        </a>
        <a 
          href="https://www.instagram.com/eljoyeroarabe/" 
          target="_blank" 
          rel="noreferrer"
          className="social-bubble"
          aria-label="Instagram"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        </a>
      </div>

      <footer 
        id="contacto"
        className="bg-primary-black px-6 py-24 border-t border-white/5 mt-auto"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-20 md:grid-cols-3">
          
          {/* Marca */}
          <div className="flex flex-col gap-8">
            <div className="flex flex-col leading-[0.8]">
              <span className="text-primary-gold font-brand text-5xl font-normal lowercase tracking-tight">Habibi</span>
              <span className="text-primary-champagne/30 font-brand text-xl font-normal lowercase tracking-[0.1em] mt-1">Parfums</span>
            </div>
            <p className="leading-relaxed text-lg text-primary-champagne/60 font-medium max-w-xs italic">
              Nuestra selección de perfumes árabes auténticos curados con la máxima precisión y sofisticación por El Joyero Arabe.
            </p>
          </div>

          {/* Ubicaciones */}
          <div className="flex flex-col gap-10">
            <h3 className="text-primary-gold font-heading text-sm tracking-[0.2em] uppercase font-bold">Locales</h3>
            <ul className="space-y-8 text-lg font-medium">
              <li className="flex flex-col gap-2">
                <span className="text-primary-champagne flex items-center gap-2">
                  <span className="text-primary-gold text-xs">◆</span> Joyería Victoria
                </span>
                <span className="text-sm text-primary-champagne/40 ml-5">Metro Centro · 19 calle 3-31, Zona 1</span>
              </li>
              <li className="flex flex-col gap-2">
                <span className="text-primary-champagne flex items-center gap-2">
                  <span className="text-primary-gold text-xs">◆</span> Joyería Glamour
                </span>
                <span className="text-sm text-primary-champagne/40 ml-5">C.C. El Pueblito · Zona 1</span>
              </li>
              <li className="flex flex-col gap-2">
                <span className="text-primary-champagne flex items-center gap-2">
                  <span className="text-primary-gold text-xs">◆</span> Joyería Luxor
                </span>
                <span className="text-sm text-primary-champagne/40 ml-5">C.C. San Isidro · Zona 16</span>
              </li>
            </ul>
          </div>

          {/* Envíos */}
          <div className="flex flex-col gap-10">
            <h3 className="text-primary-gold font-heading text-sm tracking-[0.2em] uppercase font-bold">Calidad Garantizada</h3>
            <div className="flex flex-col gap-6">
              <div className="p-8 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-3xl group hover:border-primary-gold/20 transition-all duration-700">
                <span className="text-primary-champagne text-lg font-bold block mb-3 italic">Envíos a todo el país</span>
                <span className="text-primary-champagne/40 text-sm leading-relaxed">Entrega garantizada en 24-48 horas con empaque de lujo y certificado de autenticidad.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Línea inferior */}
        <div className="mt-12 border-t border-white/[0.06] pt-6 pb-2 text-center text-[10px] tracking-wider text-primary-champagne/40">
          © {new Date().getFullYear()} Habibi Parfums. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
};