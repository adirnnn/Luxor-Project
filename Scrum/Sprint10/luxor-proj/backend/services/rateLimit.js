import { clientIp, connectingIp } from './clientIp.js';

// Limitador de intentos en memoria (suficiente para una sola instancia del backend).
const attempts = new Map();

// SFTWRKEY-453: además del límite por cliente, uno de respaldo por la IP que se conecta a
// Cloudflare, 5 veces más alto: frena a quien llama directo a Render inventando la IP del cliente
// (ver services/clientIp.js). Por el sitio todos entran desde las IPs de Vercel, por eso es más alto.
export const CONNECTION_LIMIT_FACTOR = 5;

// suma un intento a la clave; devuelve la entrada si ya pasó el máximo
const count = (key, windowMs, max) => {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.start > windowMs) {
    attempts.set(key, { start: now, count: 1 });
    return null;
  }
  if (entry.count >= max) return entry;
  entry.count += 1;
  return null;
};

// SFTWRKEY-401: onBlock avisa cuando se bloquea una ip (una vez)
export const rateLimit = ({ windowMs, max, onBlock }) => (req, res, next) => {
  const blocked =
    count(`${clientIp(req)}:${req.path}`, windowMs, max) ||
    count(`conexion:${connectingIp(req)}:${req.path}`, windowMs, max * CONNECTION_LIMIT_FACTOR);

  if (blocked) {
    if (!blocked.blocked) {
      blocked.blocked = true;
      onBlock?.(req);
    }
    return res.status(429).json({ success: false, message: 'Demasiados intentos. Intenta de nuevo más tarde.' });
  }

  next();
};
