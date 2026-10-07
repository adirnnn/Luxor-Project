import { timingSafeEqual } from 'node:crypto';

// SFTWRKEY-380: protege endpoints que solo debe llamar otro servicio nuestro (el chatbot).
// Compara la cabecera X-Internal-Key con CHATBOT_INTERNAL_KEY en tiempo constante.
// Si la variable no está configurada, rechaza todo (falla cerrado).
export const requireInternalKey = (req, res, next) => {
  const expected = process.env.CHATBOT_INTERNAL_KEY;
  const received = req.get('x-internal-key');

  if (!expected || !received) {
    return res.status(401).json({ success: false, message: 'No autorizado.' });
  }

  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, message: 'No autorizado.' });
  }

  next();
};
