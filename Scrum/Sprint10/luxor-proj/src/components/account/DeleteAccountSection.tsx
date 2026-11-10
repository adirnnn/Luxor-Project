import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { deleteMyAccount } from "../../services/adminConsoleService";

// "Borrar mi cuenta" en Mi cuenta. Las cuentas de administrador no lo ven (y el backend tampoco lo
// permite). Se confirma con la contraseña; quien entra con Google escribe ELIMINAR.
export function DeleteAccountSection() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.role === "ADMIN") return null;

  const borrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirmacion.trim()) return setError("Escribe tu contraseña para confirmar.");
    setEnviando(true);
    setError(null);
    try {
      // el mismo texto sirve como contraseña o como "ELIMINAR" (cuentas de Google)
      await deleteMyAccount({ password: confirmacion, confirm: confirmacion });
      logout();
      navigate("/", { replace: true, state: { cuentaBorrada: true } });
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-status-error/40 py-2 text-xs uppercase tracking-widest text-status-error hover:bg-status-error-bg transition-colors"
      >
        Borrar mi cuenta
      </button>
    );
  }

  return (
    <form onSubmit={borrar} className="flex flex-col gap-3 rounded-xl border border-status-error/40 bg-status-error-bg p-4 text-sm">
      <p className="font-bold text-status-error">Borrar mi cuenta</p>
      <ul className="list-disc space-y-1 pl-5 text-white/80">
        <li>Se borran tu cuenta, tu carrito, tus favoritos, tu foto y tus reseñas.</li>
        <li>Tus pedidos quedan en la tienda sin tus datos (los necesitamos para la contabilidad).</li>
        <li>No se puede deshacer.</li>
      </ul>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/70">Tu contraseña (si entras con Google, escribe ELIMINAR)</span>
        <input
          type="password"
          autoComplete="current-password"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-status-error"
        />
      </label>
      {error && <p role="alert" className="text-status-error">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="flex-1 rounded-lg bg-status-error py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-60"
        >
          {enviando ? "Borrando…" : "Sí, borrar mi cuenta"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setConfirmacion("");
            setError(null);
          }}
          className="flex-1 rounded-lg border border-white/20 py-2 text-xs uppercase tracking-widest text-white/70"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
