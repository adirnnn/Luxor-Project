import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageMeta } from "../components/seo/PageMeta";
import { AuthCard, authButtonClass } from "../components/auth/AuthCard";
import { unsubscribeRestockAlerts } from "../services/restockAlertService";

// SFTWRKEY-450: el enlace "No quiero recibir más avisos" del correo llega aquí.
// Se pide un clic: una página que cancela sola al abrirse la dispararían los revisores de enlaces del correo.
export default function RestockUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const validToken = /^[a-f0-9]{64}$/.test(token);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleClick = async () => {
    setError("");
    setLoading(true);
    const result = await unsubscribeRestockAlerts(token);
    setLoading(false);
    if (result.success) setSuccess(result.message);
    else setError(result.message);
  };

  if (!validToken) {
    return (
      <AuthCard title="Enlace inválido" subtitle="Este enlace para cancelar los avisos no es válido.">
        <PageMeta title="Cancelar avisos" noindex />
        <Link to="/perfumes" className="text-xs font-black uppercase tracking-widest text-primary-gold">
          Ver perfumes
        </Link>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard title="Listo" subtitle={success}>
        <PageMeta title="Cancelar avisos" noindex />
        <Link to="/perfumes" className={`${authButtonClass} block text-center`}>
          Ver perfumes
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Cancelar avisos"
      subtitle="Si confirmas, ya no te escribiremos cuando vuelvan los perfumes agotados que pediste. Puedes volver a pedir un aviso cuando quieras."
    >
      <PageMeta title="Cancelar avisos" noindex />
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-status-error-bg px-4 py-3 text-sm text-status-error">
          {error}
        </p>
      )}
      <button type="button" onClick={handleClick} disabled={loading} className={authButtonClass}>
        {loading ? "Cancelando…" : "No recibir más avisos"}
      </button>
    </AuthCard>
  );
}
