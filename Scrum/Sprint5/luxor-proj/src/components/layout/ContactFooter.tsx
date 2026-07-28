export const ContactFooter = () => (
  <footer id="contacto" className="bg-primary-black px-6 py-24 border-t border-white/5">
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-20 md:grid-cols-3">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col leading-[0.8]">
          <span className="text-primary-gold font-brand text-5xl font-normal lowercase tracking-tight">Habibi</span>
          <span className="text-primary-champagne/30 font-brand text-xl font-normal lowercase tracking-[0.1em] mt-1">Parfums</span>
        </div>
        <p className="leading-relaxed text-lg text-primary-champagne/60 font-medium max-w-xs italic">
          Nuestra selección de perfumes árabes auténticos, curados con precisión y sofisticación por El Joyero Arabe.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        <h2 className="text-primary-gold font-heading text-sm tracking-[0.2em] uppercase font-bold">Locales</h2>
        <ul className="space-y-8 text-lg font-medium">
          <li className="flex flex-col gap-2"><span className="text-primary-champagne flex items-center gap-2"><span className="text-primary-gold text-xs">◆</span> Joyería Victoria</span><span className="text-sm text-primary-champagne/40 ml-5">Metro Centro · 19 calle 3-31, Zona 1</span></li>
          <li className="flex flex-col gap-2"><span className="text-primary-champagne flex items-center gap-2"><span className="text-primary-gold text-xs">◆</span> Joyería Glamour</span><span className="text-sm text-primary-champagne/40 ml-5">C.C. El Pueblito · Zona 1</span></li>
          <li className="flex flex-col gap-2"><span className="text-primary-champagne flex items-center gap-2"><span className="text-primary-gold text-xs">◆</span> Joyería Luxor</span><span className="text-sm text-primary-champagne/40 ml-5">C.C. San Isidro · Zona 16</span></li>
        </ul>
      </div>

      <div className="flex flex-col gap-10">
        <h2 className="text-primary-gold font-heading text-sm tracking-[0.2em] uppercase font-bold">Calidad garantizada</h2>
        <div className="p-8 bg-white/[0.02] rounded-3xl border border-white/5 backdrop-blur-3xl">
          <span className="text-primary-champagne text-lg font-bold block mb-3 italic">Envíos a todo el país</span>
          <span className="text-primary-champagne/40 text-sm leading-relaxed">Entrega garantizada en 24-48 horas con empaque de lujo y certificado de autenticidad.</span>
        </div>
      </div>
    </div>
    <div className="mt-12 border-t border-white/[0.06] pt-6 pb-2 text-center text-[10px] tracking-wider text-primary-champagne/40">
      © {new Date().getFullYear()} Habibi Parfums. Todos los derechos reservados.
    </div>
  </footer>
);
