// transforma la respuesta cruda de PerfumAPI al modelo interno de `products` de Habibi Parfums. Vean la tabla de mapeo en docs/PERFUM_API.md.
// campos que NO vienen de la API (el admin los define a mano, por diseño): id, price, stock, category_id.

const EXTERNAL_SOURCE = 'perfumapi';

const joinNotes = (notes) => (Array.isArray(notes) ? notes.filter(Boolean).join(', ') : '');

/**
 * @param {object} externalPerfume - objeto crudo devuelto por PerfumAPI
 * @returns {object} candidato de producto, listo para autocompletar el
 *   formulario del admin (falta id/price/stock/category_id, los pone el admin)
 */
export function mapExternalPerfumeToProduct(externalPerfume) {
  const p = externalPerfume ?? {};
  return {
    name: p.name ?? '',
    brand: p.brand ?? '',
    image: p.image_url ?? '',
    description: p.description ?? '',
    notes: {
      salida: joinNotes(p.notes_top),
      corazon: joinNotes(p.notes_middle),
      fondo: joinNotes(p.notes_base),
    },
    external_source: EXTERNAL_SOURCE,
    external_id: p.id ?? null,
    synced_at: new Date().toISOString(),
  };
}

export { EXTERNAL_SOURCE };
