import type { ReactNode } from "react";
import { Link } from "react-router-dom";

// SFTWRKEY-428: contenedor simple para las pantallas de recuperar contraseña
export const AuthCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => (
  <div className="min-h-screen bg-primary-black flex flex-col items-center justify-center px-6 py-20 text-primary-champagne">
    <div className="w-full max-w-sm">
      <Link to="/" className="inline-block mb-12 text-primary-gold font-heading text-2xl font-light uppercase tracking-tight">
        Victoria
      </Link>
      <h1 className="font-heading text-4xl leading-none text-primary-gold mb-4 font-black uppercase tracking-tighter">
        {title}
      </h1>
      <p className="text-base text-primary-champagne/60 mb-10">{subtitle}</p>
      {children}
    </div>
  </div>
);

export const authInputClass =
  "w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-secondary-charcoal/50 placeholder:text-white/20 focus:ring-2 focus:ring-primary-gold transition-all duration-300 disabled:opacity-50";

export const authButtonClass =
  "mt-2 w-full py-5 rounded-button text-base font-black tracking-[0.2em] uppercase transition-all duration-500 bg-primary-gold text-primary-black hover:bg-primary-champagne disabled:bg-white/5 disabled:text-white/20 disabled:cursor-not-allowed";
