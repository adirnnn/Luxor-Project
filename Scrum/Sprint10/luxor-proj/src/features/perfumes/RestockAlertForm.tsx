import { useId, useState, type FormEvent } from "react";
import { Bell, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { subscribeRestockAlert } from "../../services/restockAlertService";

// SFTWRKEY-450: en la ficha de un perfume agotado, la persona deja su correo para que le avisen
// cuando vuelva. El correo solo se guarda si marca la casilla de consentimiento.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  productId: string;
  productName: string;
};

export function RestockAlertForm({ productId, productName }: Props) {
  const { user } = useAuth();
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(user?.email ?? "");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const correo = email.trim();
    if (!EMAIL_REGEX.test(correo)) {
      setError("Ingresa un correo válido.");
      return;
    }
    if (!consent) {
      setError("Marca la casilla para que podamos escribirte.");
      return;
    }
    setError("");
    setLoading(true);
    const result = await subscribeRestockAlert(productId, correo, consent);
    setLoading(false);
    if (result.success) setSuccess(result.message);
    else setError(result.message);
  };

  if (success) {
    return (
      <p role="status" className="flex items-start gap-3 rounded-2xl border border-status-success/40 bg-status-success-bg px-5 py-4 text-sm text-status-success">
        <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
        {success}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-3 rounded-button border-2 border-primary-gold px-10 py-5 text-base font-bold uppercase tracking-widest text-primary-gold transition-colors hover:bg-primary-gold hover:text-primary-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold md:w-auto"
      >
        <Bell size={18} aria-hidden="true" />
        Avísame cuando vuelva
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={`Aviso de disponibilidad de ${productName}`}
      className="flex flex-col gap-4 rounded-2xl border border-primary-gold/20 bg-white/[0.02] p-5"
    >
      <p className="text-sm text-primary-champagne/80">
        Te escribimos <strong className="text-primary-champagne">una sola vez</strong> cuando {productName} vuelva a estar disponible.
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-email`} className="text-xs font-black uppercase tracking-[0.2em] text-primary-gold">
          Tu correo
        </label>
        <input
          id={`${ids}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          maxLength={254}
          disabled={loading}
          placeholder="tucorreo@ejemplo.com"
          className="w-full rounded-2xl border-none bg-secondary-charcoal/50 px-5 py-4 text-base text-primary-champagne placeholder:text-white/20 focus:ring-2 focus:ring-primary-gold disabled:opacity-50"
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-primary-champagne/70">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={loading}
          className="mt-1 h-4 w-4 shrink-0 accent-primary-gold"
        />
        Acepto recibir un correo solo para avisarme cuando este perfume vuelva. Puedo cancelar los avisos desde el enlace del correo.
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-status-error-bg px-4 py-3 text-sm text-status-error">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-button bg-primary-gold px-8 py-4 text-sm font-black uppercase tracking-widest text-primary-black transition-colors hover:bg-primary-champagne disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Guardando…" : "Avisarme"}
      </button>
    </form>
  );
}
