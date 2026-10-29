// SFTWRKEY-449: costo de envío y forma de entrega. Lo acordado con el cliente (28/10/2026):
// envío a domicilio a todo el país por Q35, gratis desde Q500 en productos, y recoger en
// cualquiera de los 3 locales sin costo. Para cambiar los montos solo se toca este archivo.
// El costo siempre se calcula aquí, en el servidor; nunca se toma lo que mande el navegador.
export const SHIPPING_FLAT_CENTS = 3500;
export const FREE_SHIPPING_FROM_CENTS = 50000;

// los mismos locales de la página de envíos y del chatbot (horarios confirmados por el cliente)
export const PICKUP_STORES = [
  { id: 'victoria', name: 'Joyería Victoria', address: 'Metro Centro, 19 calle 3-31, Zona 1', hours: 'Lunes a sábado de 9:00 a 17:00' },
  { id: 'glamour', name: 'Joyería Glamour', address: 'C.C. El Pueblito, Zona 1', hours: 'Lunes a sábado de 8:00 a 17:00' },
  { id: 'luxor', name: 'Joyería Luxor', address: 'C.C. San Isidro, Zona 16', hours: 'Lunes a sábado de 10:00 a 19:00' },
];

export const DELIVERY_METHODS = ['envio', 'recoger'];

export function shippingCents(subtotalCents, method) {
  if (method === 'recoger') return 0;
  return subtotalCents >= FREE_SHIPPING_FROM_CENTS ? 0 : SHIPPING_FLAT_CENTS;
}

const invalid = (message) => Object.assign(new Error(message), { status: 400, code: 'INVALID_DELIVERY' });

const field = (value, label, min, max) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > max) throw invalid(`Revisa ${label}.`);
  return text;
};

// Valida la forma de entrega que eligió el cliente y devuelve lo que se guarda en el pedido:
// { method: 'envio', address: {...} } o { method: 'recoger', store: {...} }.
// Si no manda deliveryMethod se toma como envío (así funcionan los clientes que ya existían).
export function parseDelivery(body = {}) {
  const method = body.deliveryMethod ?? 'envio';
  if (!DELIVERY_METHODS.includes(method)) throw invalid('Elige envío a domicilio o recoger en tienda.');

  if (method === 'recoger') {
    const store = PICKUP_STORES.find((s) => s.id === body.pickupStore);
    if (!store) throw invalid('Elige el local donde vas a recoger tu pedido.');
    return { method, store };
  }

  return {
    method,
    address: {
      billingAddress: field(body.billingAddress, 'la dirección', 5, 200),
      city: field(body.city, 'la ciudad', 2, 100),
      postalCode: field(body.postalCode, 'el código postal', 4, 10),
      country: field(body.country, 'el país', 2, 60),
    },
  };
}

// Lo que el frontend necesita para mostrar el envío antes de pagar (GET /shipping)
export const shippingOptions = () => ({
  flatCents: SHIPPING_FLAT_CENTS,
  freeFromCents: FREE_SHIPPING_FROM_CENTS,
  stores: PICKUP_STORES,
});

// Forma de entrega de un pedido para mostrarla (cliente, admin, correos). Los pedidos de antes de
// SFTWRKEY-449 no la tienen; si fueron de invitado, se usa la dirección que quedó en guest_receipts.
export function deliveryView({ delivery_method: method, delivery_address: saved, guestAddress = null }) {
  if (method === 'recoger') return { method, store: saved };
  if (method === 'envio') return { method, address: saved };
  if (guestAddress?.billingAddress) return { method: 'envio', address: guestAddress };
  return null;
}
