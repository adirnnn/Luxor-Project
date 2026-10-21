// SFTWRKEY-434: términos y condiciones de uso y de compra.
import { Link } from "react-router-dom";
import { LegalPage, type LegalSection } from "../features/legal/LegalPage";

const lista = "list-disc space-y-2 pl-5 marker:text-primary-gold";
const enlace = "text-primary-gold underline-offset-4 hover:underline";

const sections: LegalSection[] = [
  {
    title: "Aceptación",
    content: (
      <p>
        Al usar este sitio, crear una cuenta o realizar una compra, aceptas estos términos y nuestra{" "}
        <Link to="/privacidad" className={enlace}>política de privacidad</Link>. Si no estás de acuerdo, por favor no
        uses el sitio.
      </p>
    ),
  },
  {
    title: "Tu cuenta",
    content: (
      <ul className={lista}>
        <li>Debes dar información verdadera y mantener tu contraseña en secreto.</li>
        <li>Eres responsable de lo que se haga con tu cuenta. Si crees que alguien entró sin permiso, cambia tu contraseña y avísanos.</li>
        <li>Podemos suspender cuentas usadas para fraude, abuso del sitio o intentos de acceso no autorizado.</li>
      </ul>
    ),
  },
  {
    title: "Productos y precios",
    content: (
      <ul className={lista}>
        <li>Todos nuestros perfumes son originales y se entregan con certificado de autenticidad.</li>
        <li>Los precios están en quetzales (GTQ). Pueden cambiar sin previo aviso, pero el precio que se cobra es el vigente al confirmar tu pedido.</li>
        <li>Las fotos son ilustrativas; el empaque puede variar según el lote del fabricante.</li>
        <li>La disponibilidad depende del inventario. Si un producto de tu carrito se agota, te avisamos antes de procesar el pago.</li>
      </ul>
    ),
  },
  {
    title: "Compras y pagos",
    content: (
      <ul className={lista}>
        <li>Aceptamos tarjetas de crédito y débito. También puedes comprar como invitado, sin crear una cuenta.</li>
        <li>El total de cada pedido se calcula siempre en nuestros servidores con los precios vigentes; cualquier monto modificado desde el navegador se ignora.</li>
        <li>El pedido queda confirmado cuando el pago es aprobado. Puedes seguir su estado (pagado, en preparación, enviado, entregado) desde <strong className="text-primary-champagne">Mi cuenta</strong>.</li>
        <li>Por seguridad, varios pagos rechazados seguidos pueden bloquear temporalmente nuevos intentos.</li>
      </ul>
    ),
  },
  {
    title: "Envíos, cambios y devoluciones",
    content: (
      <p>
        Las condiciones de entrega, cambios y devoluciones están en nuestra página de{" "}
        <Link to="/envios-devoluciones" className={enlace}>envíos y devoluciones</Link>.
      </p>
    ),
  },
  {
    title: "Uso aceptable",
    content: (
      <p>
        No está permitido intentar acceder a cuentas o áreas restringidas, automatizar compras o registros, probar
        tarjetas ajenas, ni interferir con el funcionamiento del sitio o del asistente virtual.
      </p>
    ),
  },
  {
    title: "Propiedad intelectual",
    content: (
      <p>
        Las marcas de perfumes pertenecen a sus respectivos fabricantes. El diseño, los textos y el código del sitio
        pertenecen al equipo de Perfumería Victoria.
      </p>
    ),
  },
  {
    title: "Cambios a estos términos",
    content: (
      <p>
        Podemos actualizar estos términos. La versión vigente es siempre la publicada en esta página, con su fecha de
        última actualización.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      description="Condiciones de uso del sitio y de compra en Perfumería Victoria: cuenta, precios, pagos y uso aceptable."
      title="Términos y condiciones"
      intro={<p>Estas son las reglas para usar el sitio de Perfumería Victoria y comprar en él.</p>}
      sections={sections}
    />
  );
}
