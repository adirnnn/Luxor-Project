import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { PageTitle } from "../components/ui/Typography";
import { PageMeta } from "../components/seo/PageMeta";
import { cancelPayment, type CheckoutError, type PaymentResult } from "../services/checkoutService";

// SFTWRKEY-445: Recurrente regresa aquí cuando el cliente se sale sin pagar (/pago/cancelado?ref=...).
// El backend libera el stock apartado; si en realidad sí pagó, se manda al resultado.
export default function PaymentCancelledPage() {
  const [params] = useSearchParams();
  const reference = params.get("ref") ?? "";
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!reference) return;
    let cancelado = false;
    cancelPayment(reference)
      .then((data) => !cancelado && setResult(data))
      .catch((err: CheckoutError) => !cancelado && setError(err.message));
    return () => {
      cancelado = true;
    };
  }, [reference]);

  if (!reference) return <Navigate to="/cart" replace />;
  if (result?.status === "pagado") return <Navigate to={`/pago/resultado?ref=${reference}`} replace />;

  return (
    <MainLayout>
      <PageMeta title="Pago cancelado" noindex />
      <Container className="pb-24 md:pb-32 px-4 md:px-6">
        <PageTitle className="mb-8 md:mb-12">Pago</PageTitle>
        <section className="max-w-xl mx-auto glass-card p-8 md:p-12 border-primary-gold/10 text-primary-champagne" aria-live="polite">
          {!result && !error ? (
            <p role="status">Un momento…</p>
          ) : result?.status === "pendiente" ? (
            <>
              <p className="font-bold mb-2">Tu pago todavía se está procesando</p>
              <p className="text-sm text-primary-champagne/60 mb-6">
                No vuelvas a pagar. Revisa el resultado en un momento.
              </p>
              <Link to={`/pago/resultado?ref=${reference}`} className="text-primary-gold underline">
                Ver el resultado del pago
              </Link>
            </>
          ) : (
            <>
              <p className="font-bold mb-2">No se completó el pago</p>
              <p className="text-sm text-primary-champagne/60 mb-6">
                {result?.failureReason ? `Motivo: ${result.failureReason}. ` : ""}
                No se hizo ningún cobro ni se creó el pedido. Tu carrito sigue guardado para cuando quieras intentarlo de
                nuevo.
                {error ? ` (${error})` : ""}
              </p>
              <Link to="/cart" className="text-primary-gold underline">
                Volver al carrito
              </Link>
            </>
          )}
        </section>
      </Container>
    </MainLayout>
  );
}
