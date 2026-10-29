// Menú de la cuenta en la barra de escritorio. Junta Mi cuenta, Favoritos, las opciones de
// administración y Salir en un solo botón, porque con un ADMIN la barra no cabía y los enlaces
// se partían en dos líneas. Es un menú desplegable simple: se abre con el botón, se recorre
// con Tab y se cierra con Escape, al hacer clic afuera o al elegir una opción.
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { ACCOUNT_LINKS, ADMIN_LINKS } from "./accountLinks";

import { UserAvatar } from "../account/UserAvatar";
import type { AuthUser } from "../../validation/authService";

type Props = {
  name: string;
  isAdmin: boolean;
  onLogout: () => void;
  // feedback del cliente: si el usuario tiene foto de perfil, se muestra en vez del ícono
  user?: AuthUser;
};

const item =
  "block w-full px-5 py-2.5 text-left text-xs uppercase tracking-[0.2em] font-bold transition-colors focus-visible:outline-none focus-visible:bg-white/[0.06]";

export const AccountMenu = ({ name, isAdmin, onLogout, user }: Props) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const firstName = name.trim().split(/\s+/)[0] || "Mi cuenta";
  const linkClass = (to: string) =>
    clsx(item, pathname === to ? "text-primary-gold" : "text-primary-champagne/70 hover:text-primary-gold hover:bg-white/[0.04]");

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        className="flex items-center gap-2 max-w-[11rem] text-xs uppercase tracking-[0.2em] font-bold text-primary-champagne/70 hover:text-primary-gold transition-colors"
      >
        {user?.avatarVersion ? (
          <UserAvatar user={user} className="h-7 w-7 shrink-0" />
        ) : (
        <svg aria-hidden="true" className="shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        )}
        <span className="truncate">{firstName}</span>
        <svg aria-hidden="true" className={clsx("shrink-0 transition-transform", open && "rotate-180")} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
        <span className="sr-only">: menú de la cuenta</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-5 w-60 py-2 rounded-2xl bg-primary-black/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl"
          >
            <nav aria-label="Cuenta">
              <ul>
                {ACCOUNT_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className={linkClass(link.to)} onClick={() => setOpen(false)} aria-current={pathname === link.to ? "page" : undefined}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {isAdmin && (
                <>
                  <p className="mt-2 px-5 pt-3 pb-1 border-t border-white/[0.06] text-[10px] uppercase tracking-[0.25em] text-primary-champagne/35">
                    Administración
                  </p>
                  <ul>
                    {ADMIN_LINKS.map((link) => (
                      <li key={link.to}>
                        <Link to={link.to} className={linkClass(link.to)} onClick={() => setOpen(false)} aria-current={pathname === link.to ? "page" : undefined}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </nav>
            <div className="mt-2 pt-2 border-t border-white/[0.06]">
              <button type="button" onClick={onLogout} className={clsx(item, "text-primary-champagne/70 hover:text-primary-gold hover:bg-white/[0.04]")}>
                Salir
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
