import { Router } from 'express';
import { authenticate, requireRoles } from '../services/auth.js';
import { listSyncLogs, logSyncError } from '../services/perfumSyncLog.js';
import { searchExternalPerfumes, PerfumApiError } from '../services/perfumApiClient.js';
import { getKnownBrands } from '../services/perfumBrands.js';
import { mapExternalPerfumeToProduct } from '../services/perfumMapper.js';
import { validateMappedPerfume } from '../services/perfumValidation.js';

const router = Router();

// fragmento para la integracion PerfumAPI: busqueda para el admin
// compone cliente + marcas + mapper + validacion + log de errores
// sin restriccion por catalogo propio: el admin puede buscar cualquier perfume.
router.get("/external-perfumes/search", authenticate, requireRoles("ADMIN"), async (req, res) => {
  const { q, brand } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ success: false, message: "Parámetro de búsqueda 'q' requerido." });
  }

  try {
    const raw = await searchExternalPerfumes(q, 30);
    const filtered = brand && brand.trim()
      ? raw.filter((p) => (p.brand || '').toLowerCase() === brand.trim().toLowerCase())
      : raw;

    const results = [];
    for (const item of filtered) {
      const mapped = mapExternalPerfumeToProduct(item);
      const { ok, candidate, warnings } = validateMappedPerfume(mapped);
      if (!ok) {
        await logSyncError({ query: q, externalId: item.id, errorMessage: warnings.join('; ') });
        continue;
      }
      results.push({ ...candidate, warnings });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    const message = err instanceof PerfumApiError ? err.message : 'No se pudo consultar PerfumAPI.';
    await logSyncError({ query: q, errorMessage: message });
    res.status(502).json({ success: false, message });
  }
});

// marcas conocidas por PerfumAPI, para un filtro opcional en el buscador del admin
router.get("/external-perfumes/brands", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const brands = await getKnownBrands();
    res.json({ success: true, brands });
  } catch (err) {
    console.error(err);
    const message = err instanceof PerfumApiError ? err.message : 'No se pudo consultar las marcas de PerfumAPI.';
    await logSyncError({ errorMessage: message });
    res.status(502).json({ success: false, message });
  }
});

// integracion PerfumAPI: historial de errores de sincronizacion
router.get("/admin/perfum-sync-logs", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const logs = await listSyncLogs();
    res.json({ success: true, logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "No se pudo consultar el historial de errores de PerfumAPI." });
  }
});

export default router;