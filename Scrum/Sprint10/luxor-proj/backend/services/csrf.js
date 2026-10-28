// SFTWRKEY-451: protección contra CSRF. La sesión ahora va en una cookie, y el navegador la manda
// sola en cada petición; otra página podría intentar mandar un formulario a nuestra API con la
// sesión del cliente. Además de SameSite=Lax en la cookie, toda petición que cambia datos y trae
// un Origin (los navegadores siempre lo mandan en POST, PUT, PATCH y DELETE) tiene que venir de
// nuestro frontend. Los clientes que no son navegador (pruebas, chatbot) no mandan Origin.
const METODOS_QUE_CAMBIAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const allowedOrigin = () => process.env.FRONTEND_URL || 'http://localhost:5173';

export const csrfProtection = (req, res, next) => {
  // los avisos de Recurrente (SFTWRKEY-446) los manda su servidor, no un navegador: se validan con
  // su firma y no usan la cookie de sesión, así que aquí no aplica
  if (req.path.startsWith('/webhooks/')) return next();
  const origin = req.get('origin');
  if (METODOS_QUE_CAMBIAN.has(req.method) && origin && origin !== allowedOrigin()) {
    return res.status(403).json({ success: false, message: 'Origen no permitido.' });
  }
  next();
};
