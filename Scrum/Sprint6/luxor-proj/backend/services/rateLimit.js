// Limitador de intentos en memoria (suficiente para una sola instancia del backend).
const attempts = new Map();

export const rateLimit = ({ windowMs, max }) => (req, res, next) => {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.start > windowMs) {
    attempts.set(key, { start: now, count: 1 });
    return next();
  }

  if (entry.count >= max) {
    return res.status(429).json({ success: false, message: 'Demasiados intentos. Intenta de nuevo más tarde.' });
  }

  entry.count += 1;
  next();
};
