import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageMeta } from "../components/seo/PageMeta";
import { AuthCard, authInputClass, authButtonClass } from "../components/auth/AuthCard";
import { resetPassword } from "../services/passwordResetService";
import { validatePassword } from "../validation/passwordPolicy";

// SFTWRKEY-428: crea la contraseña nueva con el token que llegó en el enlace del correo
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // SFTWRKEY-409: política de contraseñas
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);
    if (result.success) setSuccess(result.message);
    else setError(result.message);
  };

  if (!token) {
    return (
      <AuthCard title="Enlace inválido" subtitle="Este enlace no es válido o ya venció.">
        <PageMeta title="Restablecer contraseña" noindex />
        <Link to="/recuperar-contrasena" className="text-xs font-black text-primary-gold uppercase tracking-widest">
          Pedir un enlace nuevo
        </Link>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard title="Listo" subtitle={success}>
        <PageMeta title="Restablecer contraseña" noindex />
        <Link to="/login" className={`${authButtonClass} block text-center`}>
          Iniciar sesión
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nueva clave" subtitle="Elige una contraseña nueva para tu cuenta.">
      <PageMeta title="Restablecer contraseña" noindex />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {error && (
          <p role="alert" className="px-4 py-3 rounded-xl bg-status-error-bg text-sm text-status-error">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="new-password" className="text-xs font-black tracking-[0.2em] uppercase text-primary-gold">
            Contraseña nueva
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            className={authInputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="confirm-password" className="text-xs font-black tracking-[0.2em] uppercase text-primary-gold">
            Confirmar contraseña
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            className={authInputClass}
          />
        </div>
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </AuthCard>
  );
}
