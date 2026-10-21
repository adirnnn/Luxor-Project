// valida/normaliza un candidato ya mapeado (ver perfumMapper.js) antes de dejarlo autocompletar el formulario del admin o guardarse en products.

function isValidUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {object} mapped - salida de mapExternalPerfumeToProduct()
 * @returns {{ ok: boolean, candidate: object, warnings: string[] }}
 *   ok=false solo si falta el nombre (no hay nada usable que mostrar).
 *   Para el resto de campos incompletos se aplica un fallback visible y se
 *   agrega un warning, en vez de descartar el resultado silenciosamente.
 */
export function validateMappedPerfume(mapped) {
  const warnings = [];
  const candidate = { ...mapped, notes: { ...mapped.notes } };

  if (!candidate.name || !candidate.name.trim()) {
    return { ok: false, candidate, warnings: ['Sin nombre: PerfumAPI no devolvió un nombre válido.'] };
  }

  if (!isValidUrl(candidate.image)) {
    candidate.image = '';
    warnings.push('Sin imagen disponible en PerfumAPI.');
  }

  if (!candidate.description || !candidate.description.trim()) {
    candidate.description = 'Descripción no disponible desde PerfumAPI.';
    warnings.push('Sin descripción disponible en PerfumAPI.');
  }

  if (!candidate.brand || !candidate.brand.trim()) {
    candidate.brand = 'Sin marca';
    warnings.push('Sin marca disponible en PerfumAPI.');
  }

  const hasNotes = candidate.notes.salida || candidate.notes.corazon || candidate.notes.fondo;
  if (!hasNotes) {
    warnings.push('Sin notas olfativas disponibles en PerfumAPI.');
  }

  return { ok: true, candidate, warnings };
}
