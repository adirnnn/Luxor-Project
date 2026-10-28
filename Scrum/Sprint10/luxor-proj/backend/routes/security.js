import { Router } from 'express';
import { authenticate, requireRoles } from '../services/auth.js';
import { getSecurityAlerts } from '../services/securityEvents.js';

const router = Router();

// alertas de seguridad del panel admin
router.get("/admin/security-alerts", authenticate, requireRoles("ADMIN"), async (_req, res) => {
  try {
    const data = await getSecurityAlerts();
    res.set("Cache-Control", "no-store").json({ success: true, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "No se pudieron obtener las alertas de seguridad." });
  }
});

export default router;