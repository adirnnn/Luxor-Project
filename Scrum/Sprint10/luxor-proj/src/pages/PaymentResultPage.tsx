import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { PageTitle } from "../components/ui/Typography";
import { PageMeta } from "../components/seo/PageMeta";
import { useCart } from "../context/CartContext";
import { confirmPayment, type CheckoutError, type PaymentResult } from "../services/checkoutService";
import { formatPrice } from "../utils/formatPrice";
import { trackPurchase } from "../utils/analytics";
import { describeDelivery, shippingLabel } from "../utils/shipping";

// SFTWRKEY-445: Recurrente regresa aquí después del pago (/pago/resultado?ref=...).
// El backend le pregunta a Recurrente si el cobro quedó aprobado; solo entonces existe el pedido.
// Con cuenta se pasa a la confirmación del pedido (SFTWRKEY-421); el invitado ve aquí su comprobante.
const MAX_INTENTOS = 10;
const ESPERA_MS = 3000;

const card = "max-w-xl mx-auto glass-card p-8 md:p-12 border-primary-gold/10 text-primary-champagne";

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const reference = params.get("ref") ?? "";
  const { clearCart } = useCart();
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState("");
  const [rendido, setRendido] = useState(false);
  const clearRef = useRef(clearCart);
  clearRef.current = clearCart;

  useEffect(() => {
    if (!reference) return;
    let cancelado = false;
    let intentos = 0;
    let timer: ReturnType<typeof setTimeout>;

    // Recurrente puede tardar unos segundos en marcar el pago: se vuelve a preguntar un rato
    const consultar = async () => {
      try {
        const data = await confirmPayment(reference);
        if (cancelado) return;
        setResult(data);
        if (data.status === "pagado") {
          clearRef.current();
          sessionStorage.removeItem("luxor-guest-purchase");
          // solo se cuenta una vez por pedido, aunque recargue la página
          const visto = `luxor-compra-${data.order?.id}`;
          if (data.order && !sessionStorage.getItem(visto)) {
            sessionStorage.setItem(visto, "1");
            trackPurchase(data.order.total, data.order.items.reduce((n, i) => n + i.quantity, 0));
          }
        } else if (data.status === "pendiente" && ++intentos < MAX_INTENTOS) {
          timer = setTimeout(consultar, ESPERA_MS);
        } else if (data.status === "pendiente") {
          setRendido(true);
        }
      } catch (err) {
        if (!cancelado) setError((err as CheckoutError).message);
      }
    };

    void consultar();
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [reference]);

  if (!reference) return <Navigate to="/cart" replace />;

  // con cuenta: la confirmación del pedido vive en su propia página
  if (result?.status === "pagado" && !result.guest && result.order) {
    return <Navigate to={`/compra-confirmada/${result.order.id}`} replace />;
  }

  return (
    <MainLayout>
      <PageMeta title="Resultado del pago" noindex />
      <Container className="pb-24 md:pb-32 px-4 md:px-6">
        <PageTitle className="mb-8 md:mb-12">Pago</PageTitle>
        <section className={card} aria-live="polite">
          {error ? (
            <>
              <p className="font-bold text-status-error mb-2">No pudimos revisar tu pago</p>
              <p className="text-sm text-primary-champagne/60 mb-6">{error}</p>
              <button onClick={() => window.location.reload()} className="text-primary-gold underline">
                Intentar de nuevo
              </button>
            </>
          ) : result?.status === "pagado" && result.order ? (
            <>
              <p className="text-2xl font-heading text-primary-gold mb-2">¡Gracias por tu compra!</p>
              <p className="mb-6 text-primary-champagne/70">
                Pedido <strong className="text-primary-champagne">#{result.order.id}</strong>. Guarda este número:
                con él y tu correo puedes consultar el estado con el asistente o por WhatsApp.
              </p>
              <ul className="mb-4 space-y-2 text-sm">
                {result.order.items.map((item) => (
                  <li key={item.name} className="flex justify-between gap-4">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              {/* SFTWRKEY-449: envío y forma de entrega */}
              <p className="flex justify-between gap-4 text-sm">
                <span>{result.order.delivery?.method === "recoger" ? "Recoger en tienda" : "Envío"}</span>
                <span>{shippingLabel(result.order.shipping ?? 0)}</span>
              </p>
              {describeDelivery(result.order.delivery) && (
                <p className="mt-2 text-xs text-primary-champagne/50">{describeDelivery(result.order.delivery)}</p>
              )}
              <p className="mt-4 flex justify-between border-t border-white/10 pt-4 font-black text-primary-gold">
                <span>Total</span>
                <span>{formatPrice(result.order.total)}</span>
              </p>
              {result.payment?.last4 && (
                <p className="mt-2 text-xs text-primary-champagne/50">
                  Pagado con {result.payment.brand ?? "tarjeta"} •••• {result.payment.last4}
                </p>
              )}
              <Link to="/perfumes" className="mt-8 inline-block text-primary-gold underline">
                Seguir comprando
              </Link>
            </>
          ) : result?.status === "cancelado" ? (
            <>
              <p className="font-bold mb-2">El pago no se completó</p>
              <p className="text-sm text-primary-champagne/60 mb-6">
                {result.failureReason ? `Motivo: ${result.failureReason}. ` : ""}No se hizo ningún cobro ni se creó el
                pedido. Tu carrito sigue guardado.
              </p>
              <Link to="/cart" className="text-primary-gold underline">
                Volver al carrito
              </Link>
            </>
          ) : rendido ? (
            <>
              <p className="font-bold mb-2">Todavía no recibimos la confirmación del pago</p>
              <p className="text-sm text-primary-champagne/60 mb-6">
                {result?.failureReason
                  ? `Recurrente rechazó el pago: ${result.failureReason}. Puedes volver a intentarlo.`
                  : "Si ya pagaste, no vuelvas a pagar: en unos minutos se confirma solo y te llega el correo."}
              </p>
              <button onClick={() => window.location.reload()} className="text-primary-gold underline">
                Revisar de nuevo
              </button>
            </>
          ) : (
            <p role="status">Confirmando tu pago con Recurrente…</p>
          )}
        </section>
      </Container>
    </MainLayout>
  );
}
