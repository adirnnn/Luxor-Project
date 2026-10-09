// SFTWRKEY-417: estados del pedido y a cuales se puede pasar desde cada uno.
// entregado y cancelado son finales, no se pueden cambiar.
export const ORDER_STATUSES = ['pagado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'];

export const ORDER_TRANSITIONS = {
  pagado: ['en_preparacion', 'cancelado'],
  en_preparacion: ['enviado', 'cancelado'],
  enviado: ['entregado'],
  entregado: [],
  cancelado: [],
};

export const isValidStatus = (status) => ORDER_STATUSES.includes(status);

export const canTransition = (from, to) => (ORDER_TRANSITIONS[from] ?? []).includes(to);
