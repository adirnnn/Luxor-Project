import { useState } from "react";
import { useLocation } from "react-router-dom";

// Confirmación después de borrar la cuenta desde Mi cuenta (llega en el state de la navegación)
export function AccountDeletedNotice() {
  const location = useLocation();
  const borrada = (location.state as { cuentaBorrada?: boolean } | null)?.cuentaBorrada === true;
  const [cerrado, setCerrado] = useState<string | null>(null);
  if (!borrada || cerrado === location.key) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 top-24 z-[130] flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-status-success/40 bg-primary-black/95 px-5 py-4 text-sm text-primary-champagne shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
    >
      <p className="flex-1">Tu cuenta se borró. Gracias por haber comprado con nosotros.</p>
      <button
        type="button"
        onClick={() => setCerrado(location.key)}
        aria-label="Cerrar aviso"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none hover:bg-white/10"
      >
        ×
      </button>
    </div>
  );
}
