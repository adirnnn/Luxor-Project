// SFTWRKEY-434: política de privacidad. Describe solo los datos que el sitio guarda de verdad.
import { LegalPage, type LegalSection } from "../features/legal/LegalPage";

const lista = "list-disc space-y-2 pl-5 marker:text-primary-gold";

const sections: LegalSection[] = [
  {
    title: "Datos que recopilamos",
    content: (
      <ul className={lista}>
        <li><strong className="text-primary-champagne">Cuenta:</strong> nombre, correo electrónico y contraseña. La contraseña se guarda cifrada (hash bcrypt); nadie, ni siquiera el equipo, puede leerla.</li>
        <li><strong className="text-primary-champagne">Inicio de sesión con Google:</strong> tu nombre, tu correo y el identificador de tu cuenta de Google. No recibimos tu contraseña de Google.</li>
        <li><strong className="text-primary-champagne">Compras:</strong> los productos, cantidades, montos y el estado de cada pedido. En compras como invitado, también el nombre, el correo y la dirección de envío.</li>
        <li><strong className="text-primary-champagne">Pagos:</strong> solo la marca de la tarjeta y sus últimos 4 dígitos. Nunca guardamos el número completo, la fecha de vencimiento ni el CVV.</li>
        <li><strong className="text-primary-champagne">Seguridad:</strong> la dirección IP y el correo usados en intentos de inicio de sesión fallidos, para detectar ataques.</li>
        <li><strong className="text-primary-champagne">Visitas al sitio:</strong> usamos Vercel Web Analytics para contar cuántas personas visitan el sitio, de qué país y desde qué página llegan, qué perfumes se ven y cuántas compras se completan. No usa cookies, no te identifica ni guarda tu nombre, correo ni datos de tarjeta.</li>
        <li><strong className="text-primary-champagne">Asistente virtual:</strong> las preguntas que le haces al chatbot y sus respuestas, sin asociarlas a tu cuenta.</li>
      </ul>
    ),
  },
  {
    title: "Para qué los usamos",
    content: (
      <ul className={lista}>
        <li>Crear y mantener tu cuenta, tu carrito y tu historial de pedidos.</li>
        <li>Procesar y dar seguimiento a tus compras y envíos.</li>
        <li>Proteger el sitio: limitar intentos de acceso y alertar al administrador sobre actividad sospechosa.</li>
        <li>Mejorar las respuestas del asistente virtual, conocer las ventas de la tienda mediante reportes internos y saber qué perfumes interesan más con estadísticas anónimas de visitas.</li>
      </ul>
    ),
  },
  {
    title: "Con quién los compartimos",
    content: (
      <>
        <p>No vendemos ni compartimos tus datos con terceros para publicidad. Solo intervienen los proveedores que hacen funcionar el sitio:</p>
        <ul className={lista}>
          <li>Vercel y Render, donde se aloja el sitio y la base de datos. Vercel también nos da las estadísticas anónimas de visitas.</li>
          <li>El procesador de pagos, que recibe los datos de tu tarjeta directamente para autorizar el cobro.</li>
          <li>Google, únicamente si eliges iniciar sesión con tu cuenta de Google.</li>
          <li>El proveedor del modelo de lenguaje del asistente virtual, que recibe el texto de tus preguntas para generar la respuesta.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Almacenamiento en tu navegador",
    content: (
      <p>
        El sitio guarda en tu navegador (almacenamiento local) tu sesión y tu carrito, para que no se pierdan al recargar
        la página. No usamos cookies de publicidad ni de rastreo: la analítica de visitas funciona sin cookies. Al cerrar sesión, se borra tu
        sesión del navegador.
      </p>
    ),
  },
  {
    title: "Seguridad",
    content: (
      <p>
        Todo el tráfico viaja cifrado por HTTPS, las contraseñas se guardan con hash, el acceso a los datos de cada
        cuenta está restringido a su dueño y a los administradores, y el sitio se revisa con las recomendaciones de
        seguridad de OWASP. Aun así, ningún sistema es infalible: usa una contraseña única y no la compartas.
      </p>
    ),
  },
  {
    title: "Tus derechos",
    content: (
      <p>
        Puedes consultar y actualizar tus datos y tu contraseña desde <strong className="text-primary-champagne">Mi cuenta</strong>.
        Si quieres que eliminemos tu cuenta o tienes preguntas sobre tus datos, escríbenos por WhatsApp y atenderemos tu
        solicitud.
      </p>
    ),
  },
  {
    title: "Cambios a esta política",
    content: (
      <p>
        Si cambiamos esta política, actualizaremos la fecha de “Última actualización” al inicio de esta página.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      description="Qué datos recopila Perfumería Victoria, para qué los usa, con quién los comparte y cómo los protege."
      title="Política de privacidad"
      intro={
        <p>
          En Perfumería Victoria cuidamos tus datos. Esta política explica qué información recopilamos cuando usas el
          sitio, para qué la usamos y cómo la protegemos.
        </p>
      }
      sections={sections}
    />
  );
}
