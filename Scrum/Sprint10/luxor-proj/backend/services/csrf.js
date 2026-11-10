// SFTWRKEY-451: protección contra CSRF. La sesión ahora va en una cookie, y el navegador la manda
// sola en cada petición; otra página podría intentar mandar un formulario a nuestra API con la
// sesión del cliente. Además de SameSite=Lax en la cookie, toda petición que cambia datos y trae
// un Origin (los navegadores siempre lo mandan en POST, PUT, PATCH y DELETE) tiene que venir de
// nuestro frontend. Los clientes que no son navegador (pruebas, chatbot) no mandan Origin.
const METODOS_QUE_CAMBIAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const allowedOrigin = () => process.env.FRONTEND_URL || 'http://localhost:5173';

// el sitio puede tener más de una dirección (el dominio propio y la de Vercel mientras se cambia):
// FRONTEND_URL es la principal (la de los enlaces de los correos) y EXTRA_FRONTEND_URLS las demás,
// separadas por coma. Se comparan sin la barra final.
const sinBarra = (url) => url.trim().replace(/\/+$/, '');
export const allowedOrigins = (env = process.env) =>
  [env.FRONTEND_URL || 'http://localhost:5173', ...(env.EXTRA_FRONTEND_URLS || '').split(',')]
    .map(sinBarra)
    .filter(Boolean);

export const csrfProtection = (req, res, next) => {
  // los avisos de Recurrente (SFTWRKEY-446) los manda su servidor, no un navegador: se validan con
  // su firma y no usan la cookie de sesión, así que aquí no aplica
  if (req.path.startsWith('/webhooks/')) return next();
  const origin = req.get('origin');
  if (METODOS_QUE_CAMBIAN.has(req.method) && origin && !allowedOrigins().includes(sinBarra(origin))) {
    return res.status(403).json({ success: false, message: 'Origen no permitido.' });
  }
  next();
};
