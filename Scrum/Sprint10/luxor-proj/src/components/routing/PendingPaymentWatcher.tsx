import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { releasePendingPayment } from "../../services/pendingPayment";

// Libera el stock apartado de un pago que el cliente dejó sin terminar (services/pendingPayment.ts).
// Corre al cambiar de página y cuando el navegador muestra la tienda desde su caché al darle "atrás"
// (evento pageshow), porque en ese caso la página no se vuelve a cargar.
export function PendingPaymentWatcher() {
  const { pathname } = useLocation();

  useEffect(() => {
    void releasePendingPayment(pathname);
  }, [pathname]);

  useEffect(() => {
    const alVolver = (e: PageTransitionEvent) => {
      if (e.persisted) void releasePendingPayment(window.location.pathname);
    };
    window.addEventListener("pageshow", alVolver);
    return () => window.removeEventListener("pageshow", alVolver);
  }, []);

  return null;
}
