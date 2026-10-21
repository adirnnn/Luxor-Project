import { useState } from "react";
import { Link } from "react-router-dom";
import { PageMeta } from "../components/seo/PageMeta";
import { AuthCard, authInputClass, authButtonClass } from "../components/auth/AuthCard";
import { requestPasswordReset } from "../services/passwordResetService";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SFTWRKEY-428: pide el correo y manda el enlace para restablecer la contraseña
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ message: string; devResetUrl?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Ingresa un correo válido.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await requestPasswordReset(email.trim());
    setLoading(false);
    if (result.success) setDone({ message: result.message, devResetUrl: result.devResetUrl });
    else setError(result.message);
  };

  return (
    <AuthCard title="Recuperar" subtitle="Te enviaremos un enlace para crear una contraseña nueva.">
      <PageMeta title="Recuperar contraseña" noindex />

      {done ? (
        <div className="flex flex-col gap-6">
          <p role="status" className="px-4 py-3 rounded-xl border border-primary-gold/40 text-sm text-primary-champagne">
            {done.message}
          </p>
          {/* Solo aparece en desarrollo local (sin proveedor de correo) */}
          {done.devResetUrl && (
            <a href={done.devResetUrl} className="text-xs break-all text-primary-gold underline">
              Enlace de prueba (solo local): {done.devResetUrl}
            </a>
          )}
          <Link to="/login" className="text-xs font-black text-primary-gold uppercase tracking-widest">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          {error && (
            <p role="alert" className="px-4 py-3 rounded-xl bg-status-error-bg text-sm text-status-error">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor="forgot-email" className="text-xs font-black tracking-[0.2em] uppercase text-primary-gold">
              Correo electrónico
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              disabled={loading}
              className={authInputClass}
            />
          </div>
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? "Enviando…" : "Enviar enlace"}
          </button>
          <Link to="/login" className="text-center text-xs font-black text-primary-gold uppercase tracking-widest">
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </AuthCard>
  );
}
