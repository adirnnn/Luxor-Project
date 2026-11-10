import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { resendVerification } from "../../services/emailVerificationService";

// Aviso para las cuentas creadas desde la tienda que todavía no confirman su correo.
// - EmailVerificationNotice: dentro de una página (Mi cuenta, pago).
// - EmailVerificationToast: flotante en todo el sitio; se puede cerrar hasta la próxima visita.
const CERRADO_KEY = "luxor_aviso_verificacion_cerrado";

function useReenviar() {
  const { refreshSession } = useAuth();
  const [estado, setEstado] = useState<{ enviando: boolean; mensaje: string | null; ok: boolean }>({ enviando: false, mensaje: null, ok: false });
  const reenviar = async () => {
    setEstado({ enviando: true, mensaje: null, ok: false });
    const r = await resendVerification();
    setEstado({ enviando: false, mensaje: r.message, ok: r.ok });
    if (r.alreadyVerified) refreshSession();
  };
  return { ...estado, reenviar };
}

export function EmailVerificationNotice({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { enviando, mensaje, ok, reenviar } = useReenviar();
  if (!user || user.emailVerified !== false) return null;

  return (
    <div role="status" className={`rounded-2xl border border-status-warning/40 bg-status-warning-bg px-5 py-4 text-sm text-primary-champagne ${className}`}>
      <p className="font-bold text-primary-gold mb-1">Confirma tu correo</p>
      <p>
        Te enviamos un enlace a <strong>{user.email}</strong>. Ábrelo para poder comprar con tu cuenta. Si no lo ves,
        revisa la carpeta de spam.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reenviar}
          disabled={enviando}
          className="rounded-full border border-primary-gold/60 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary-gold hover:bg-primary-gold hover:text-primary-black disabled:opacity-50 transition-colors"
        >
          {enviando ? "Enviando…" : "Reenviar correo"}
        </button>
        {mensaje && <span className={ok ? "text-status-success" : "text-status-error"}>{mensaje}</span>}
      </div>
    </div>
  );
}

export function EmailVerificationToast() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [cerrado, setCerrado] = useState(() => {
    try {
      return sessionStorage.getItem(CERRADO_KEY) === "1";
    } catch {
      return false;
    }
  });
  // en Mi cuenta, el pago y la propia página de confirmación ya está el aviso en la página
  const enPagina = ["/verificar-correo", "/mi-cuenta", "/pago"].includes(pathname);
  if (!user || user.emailVerified !== false || cerrado || enPagina) return null;

  const cerrar = () => {
    setCerrado(true);
    try {
      sessionStorage.setItem(CERRADO_KEY, "1");
    } catch {
      // sin almacenamiento solo se cierra en esta vista
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 z-[120] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
      {/* fondo sólido debajo del aviso: si no, el contenido de la página se ve a través */}
      <div className="relative rounded-2xl bg-primary-black">
        <EmailVerificationNotice className="pr-12" />
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar aviso"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-primary-champagne hover:bg-white/10"
        >
          ×
        </button>
      </div>
    </div>
  );
}
