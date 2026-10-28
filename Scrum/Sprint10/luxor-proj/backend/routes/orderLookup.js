import { Router } from 'express';
import pool from '../db.js';
import { requireInternalKey } from '../services/internalKey.js';
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from '../services/securityEvents.js';
import { clientIp } from '../services/clientIp.js';

const router = Router();

// SFTWRKEY-458: el chatbot consulta el estado de un pedido con el número y el correo de la compra.
// Solo lo llama el chatbot (clave interna). Si el número y el correo no coinciden se responde
// lo mismo que si el pedido no existiera, sin ningún detalle.

// límites para que no se puedan adivinar pedidos:
// - por cliente: 5 consultas cada 15 min
// - por pedido: 5 intentos fallidos por hora (alguien probando correos para un número)
// - por correo: 10 intentos fallidos por hora (alguien probando números para un correo)
export const LIMITES = {
  cliente: { max: 5, ventanaMs: 15 * 60_000 },
  pedido: { max: 5, ventanaMs: 60 * 60_000 },
  correo: { max: 10, ventanaMs: 60 * 60_000 },
};

const contadores = new Map();

// suma 1 al contador de la clave y dice si ya pasó el máximo
const sumar = (clave, { ventanaMs }) => {
  const ahora = Date.now();
  const entrada = contadores.get(clave);
  if (!entrada || ahora - entrada.inicio > ventanaMs) {
    contadores.set(clave, { inicio: ahora, cuenta: 1 });
    return 1;
  }
  entrada.cuenta += 1;
  return entrada.cuenta;
};

const yaPaso = (clave, { max, ventanaMs }) => {
  const entrada = contadores.get(clave);
  return Boolean(entrada) && Date.now() - entrada.inicio <= ventanaMs && entrada.cuenta >= max;
};

// para las pruebas
export const reiniciarLimites = () => contadores.clear();

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_REGEX = /^[0-9a-fA-F:.]{3,45}$/;

const demasiados = (res) =>
  res.status(429).json({ found: false, message: 'Demasiados intentos. Intenta de nuevo más tarde.' });

router.post('/internal/orders/lookup', requireInternalKey, async (req, res) => {
  // la ip del cliente la manda el chatbot (todas las consultas llegan desde el chatbot)
  const enviada = req.get('x-client-ip');
  const ip = enviada && IP_REGEX.test(enviada) ? enviada : clientIp(req);

  const consultas = sumar(`cliente:${ip}`, LIMITES.cliente);
  if (consultas > LIMITES.cliente.max) {
    // se avisa al admin una sola vez por ventana (SFTWRKEY-401)
    if (consultas === LIMITES.cliente.max + 1) {
      await recordSecurityEvent({ type: SECURITY_EVENT_TYPES.RATE_LIMITED, ip, path: req.path });
    }
    return demasiados(res);
  }

  const numero = Number(req.body?.order_id);
  const correo = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!Number.isInteger(numero) || numero <= 0 || numero > 2147483647 || correo.length > 254 || !CORREO_REGEX.test(correo)) {
    return res.status(400).json({ found: false, message: 'Número de pedido o correo no válido.' });
  }

  if (yaPaso(`pedido:${numero}`, LIMITES.pedido) || yaPaso(`correo:${correo}`, LIMITES.correo)) {
    return demasiados(res);
  }

  try {
    const result = await pool.query(
      `SELECT o.id, o.status, o.created_at,
              (SELECT MAX(h.changed_at) FROM order_status_history h WHERE h.order_id = o.id) AS updated_at
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN guest_receipts g ON g.order_id = o.id
       WHERE o.id = $1 AND LOWER(COALESCE(u.email, g.guest_email)) = $2`,
      [numero, correo]
    );

    if (result.rows.length === 0) {
      sumar(`pedido:${numero}`, LIMITES.pedido);
      sumar(`correo:${correo}`, LIMITES.correo);
      return res.status(404).json({ found: false, message: 'No encontramos ese pedido.' });
    }

    // solo el estado y las fechas: nada de nombre, dirección, productos ni total
    const pedido = result.rows[0];
    res.json({
      found: true,
      order: {
        id: pedido.id,
        status: pedido.status,
        created_at: pedido.created_at,
        updated_at: pedido.updated_at ?? pedido.created_at,
      },
    });
  } catch (err) {
    console.error('Error consultando el pedido para el chatbot:', err.message);
    res.status(500).json({ found: false, message: 'No se pudo consultar el pedido.' });
  }
});

export default router;
