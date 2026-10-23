// SFTWRKEY-437: preguntas frecuentes. Las respuestas salen de la misma información que usa el
// chatbot (backend/chatbot/app/bot/store_info.py) y de las páginas legales, para que digan lo mismo.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LegalPage, type LegalSection } from "../features/legal/LegalPage";

type Faq = { question: string; answer: ReactNode };

const enlace = "text-primary-gold underline-offset-4 hover:underline";
const whatsapp = (
  <a href="https://wa.me/50247143882" target="_blank" rel="noreferrer" className={enlace}>
    WhatsApp al +502 4714 3882
  </a>
);

const GROUPS: Array<{ title: string; faqs: Faq[] }> = [
  {
    title: "Compras",
    faqs: [
      {
        question: "¿Los perfumes son originales?",
        answer: "Sí. Todos nuestros perfumes son originales, seleccionados por El Joyero Árabe, y se entregan con certificado de autenticidad.",
      },
      {
        question: "¿Necesito crear una cuenta para comprar?",
        answer: "No. Puedes comprar como invitado. Con una cuenta, además, puedes guardar tu carrito y ver el historial y el estado de tus pedidos en Mi cuenta.",
      },
      {
        question: "¿Cómo encuentro un perfume según el aroma que me gusta?",
        answer: (
          <>
            En el <Link to="/perfumes" className={enlace}>catálogo</Link> puedes buscar por nombre, marca, categoría o nota
            olfativa (por ejemplo, vainilla u oud). También puedes preguntarle al asistente virtual del sitio, que te
            recomienda perfumes según lo que buscas.
          </>
        ),
      },
      {
        question: "¿Qué pasa si un perfume se agota mientras compro?",
        answer: "Antes de procesar el pago revisamos que haya existencias. Si algún producto de tu carrito ya no está disponible, te avisamos y no se realiza el cobro.",
      },
    ],
  },
  {
    title: "Pagos",
    faqs: [
      {
        question: "¿Qué formas de pago aceptan en el sitio?",
        answer: "Tarjetas de crédito y débito Visa, Mastercard y American Express. Los precios están en quetzales (GTQ).",
      },
      {
        question: "¿Es seguro pagar con mi tarjeta?",
        answer: (
          <>
            Sí. Todo viaja cifrado por HTTPS y nunca guardamos el número completo de tu tarjeta, su fecha de vencimiento ni
            el CVV: solo la marca y los últimos 4 dígitos para identificar el pago. Más detalles en nuestra{" "}
            <Link to="/privacidad" className={enlace}>política de privacidad</Link>.
          </>
        ),
      },
      {
        question: "Mi pago fue rechazado, ¿qué hago?",
        answer: "El mensaje te indica el motivo (fondos insuficientes, tarjeta vencida o CVV incorrecto, por ejemplo). Revisa los datos o intenta con otra tarjeta. Por seguridad, muchos intentos seguidos pueden bloquear temporalmente nuevos pagos.",
      },
    ],
  },
  {
    title: "Envíos y devoluciones",
    faqs: [
      {
        question: "¿Hacen envíos a todo el país? ¿Cuánto tardan?",
        answer: "Sí, enviamos a todo el país. La entrega es en 24 a 48 horas después de confirmado el pago, en empaque de lujo y con certificado de autenticidad.",
      },
      {
        question: "¿Cómo sé en qué va mi pedido?",
        answer: (
          <>
            En <Link to="/mi-cuenta" className={enlace}>Mi cuenta</Link> ves el estado de cada pedido: pagado, en
            preparación, enviado o entregado. Si compraste como invitado, escríbenos por {whatsapp} con tu número de pedido.
          </>
        ),
      },
      {
        question: "¿Puedo recoger mi pedido en tienda?",
        answer: "Sí, puedes acercarte a cualquiera de nuestros locales: Joyería Victoria (Metro Centro, 19 calle 3-31, Zona 1), Joyería Glamour (C.C. El Pueblito, Zona 1) o Joyería Luxor (C.C. San Isidro, Zona 16).",
      },
      {
        question: "¿Puedo cambiar o devolver un perfume?",
        answer: (
          <>
            Por higiene, solo cambiamos perfumes sellados, sin abrir y en su empaque original, salvo defecto de fábrica. Si
            tu pedido llegó dañado o incompleto, escríbenos por {whatsapp} con tu número de pedido y una foto. Consulta
            todas las condiciones en <Link to="/envios-devoluciones" className={enlace}>envíos y devoluciones</Link>.
          </>
        ),
      },
    ],
  },
  {
    title: "Tu cuenta",
    faqs: [
      {
        question: "¿Puedo iniciar sesión con Google?",
        answer: "Sí. En la página de inicio de sesión puedes entrar con tu cuenta de Google, sin crear una contraseña nueva.",
      },
      {
        question: "¿Cómo cambio mis datos o mi contraseña?",
        answer: (
          <>
            Desde <Link to="/mi-cuenta" className={enlace}>Mi cuenta</Link> puedes actualizar tu nombre, tu correo y tu
            contraseña.
          </>
        ),
      },
      {
        question: "¿Cómo elimino mi cuenta?",
        answer: <>Escríbenos por {whatsapp} y atenderemos tu solicitud.</>,
      },
    ],
  },
  {
    title: "Contacto",
    faqs: [
      {
        question: "¿Cómo me comunico con ustedes?",
        answer: (
          <>
            Por {whatsapp}, en Instagram como{" "}
            <a href="https://www.instagram.com/eljoyeroarabe/" target="_blank" rel="noreferrer" className={enlace}>
              @eljoyeroarabe
            </a>{" "}
            o visitando uno de nuestros locales.
          </>
        ),
      },
    ],
  },
];

// <details>/<summary>: se abre y se cierra con Enter o Espacio, y los lectores de pantalla lo anuncian
// como expandible, sin JavaScript adicional.
const FaqItem = ({ question, answer }: Faq) => (
  <details className="group rounded-2xl border border-white/10 bg-white/[0.02] transition-colors open:border-primary-gold/40">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 text-base font-medium text-primary-champagne marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-gold [&::-webkit-details-marker]:hidden">
      <span>{question}</span>
      <span aria-hidden="true" className="text-xl text-primary-gold transition-transform group-open:rotate-45">+</span>
    </summary>
    <div className="px-5 pb-5 text-base leading-relaxed text-primary-champagne/70">{answer}</div>
  </details>
);

const sections: LegalSection[] = GROUPS.map((group) => ({
  title: group.title,
  content: (
    <div className="flex flex-col gap-3">
      {group.faqs.map((faq) => (
        <FaqItem key={faq.question} {...faq} />
      ))}
    </div>
  ),
}));

export default function FaqPage() {
  return (
    <LegalPage
      title="Preguntas frecuentes"
      description="Respuestas sobre compras, pagos, envíos, devoluciones y tu cuenta en Perfumería Victoria: autenticidad, tiempos de entrega, formas de pago y más."
      intro={<p>Aquí respondemos las dudas más comunes. Si no encuentras la tuya, escríbenos o pregúntale al asistente virtual.</p>}
      sections={sections}
    />
  );
}
