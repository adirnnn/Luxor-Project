// SFTWRKEY-434: envíos y devoluciones.
// Los datos de envío vienen del footer y de store_info.py del chatbot. La política de cambios
// todavía no está confirmada por la tienda, así que aquí no se inventan plazos.
import { LegalPage, type LegalSection } from "../features/legal/LegalPage";
import { StoreLocations } from "../components/stores/StoreMap";
import { DEFAULT_SHIPPING } from "../utils/shipping";

const lista = "list-disc space-y-2 pl-5 marker:text-primary-gold";

const sections: LegalSection[] = [
  {
    title: "Cobertura y tiempos de entrega",
    content: (
      <ul className={lista}>
        <li>Enviamos a todo el país por Q35. El envío es gratis desde Q500 en productos.</li>
        <li>La entrega es en 24 a 48 horas después de confirmado el pago.</li>
        <li>Cada perfume va en empaque de lujo y con su certificado de autenticidad.</li>
      </ul>
    ),
  },
  {
    title: "Seguimiento del pedido",
    content: (
      <p>
        Puedes ver el estado de tu pedido (pagado, en preparación, enviado o entregado) en{" "}
        <strong className="text-primary-champagne">Mi cuenta</strong>. Si compraste como invitado, usa el número de
        pedido que aparece al confirmar la compra o escríbenos por WhatsApp.
      </p>
    ),
  },
  {
    title: "Recogida en tienda",
    content: (
      <>
        <p className="mb-4">Si prefieres, elige "Recoger en tienda" al pagar (sin costo de envío) y pasa por tu pedido a cualquiera de nuestros locales, de lunes a sábado:</p>
        {/* feedback del cliente: mapa y horario de cada local */}
        <StoreLocations stores={DEFAULT_SHIPPING.stores} />
      </>
    ),
  },
  {
    title: "Problemas con tu pedido",
    content: (
      <p>
        Si tu perfume llega dañado, incompleto o no es el que pediste, escríbenos por WhatsApp lo antes posible con tu
        número de pedido y una foto del producto y del empaque. Revisaremos tu caso y te ofreceremos un cambio o una
        solución.
      </p>
    ),
  },
  {
    title: "Cambios y devoluciones",
    content: (
      <ul className={lista}>
        <li>Por higiene, solo se aceptan cambios de perfumes sellados, sin abrir ni usar y con su empaque original.</li>
        <li>Los perfumes abiertos o usados no tienen cambio, salvo que presenten un defecto de fábrica.</li>
        <li>Para solicitar un cambio o devolución, escríbenos por WhatsApp con tu número de pedido; te indicaremos los pasos.</li>
      </ul>
    ),
  },
];

export default function ShippingReturnsPage() {
  return (
    <LegalPage
      description="Envíos a todo el país en 24 a 48 horas, seguimiento del pedido, cambios y devoluciones en Perfumería Victoria."
      title="Envíos y devoluciones"
      intro={<p>Así entregamos tus perfumes y así resolvemos cualquier problema con tu compra.</p>}
      sections={sections}
    />
  );
}
