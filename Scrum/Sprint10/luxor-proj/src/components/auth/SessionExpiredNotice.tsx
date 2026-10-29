import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Aviso cuando la sesión vence (8 horas) con la página abierta. Antes el panel del admin mostraba
// listas vacías o errores sin explicar por qué; ahora se pide volver a iniciar sesión.
// En /login no se muestra: ahí el formulario ya trae el mismo aviso.
export function SessionExpiredNotice() {
  const { sessionExpired, dismissSessionExpired } = useAuth();
  const { pathname } = useLocation();
  if (!sessionExpired || pathname === "/login") return null;

  return (
    <div
      role="alert"
      className="fixed left-1/2 top-24 z-[130] flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-status-warning/40 bg-primary-black/95 px-5 py-4 text-sm text-primary-champagne shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
    >
      <p className="flex-1">
        Tu sesión expiró. <Link to="/login" className="font-bold text-primary-gold underline">Inicia sesión</Link> de
        nuevo para continuar.
      </p>
      <button
        type="button"
        onClick={dismissSessionExpired}
        aria-label="Cerrar aviso"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none hover:bg-white/10"
      >
        ×
      </button>
    </div>
  );
}
