import jwt from 'jsonwebtoken';

const JWT_EXPIRES_IN = '8h';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no está configurado. Defínelo en el archivo .env.');
  }
  return secret;
};

export const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, getSecret(), { expiresIn: JWT_EXPIRES_IN });

// SFTWRKEY-451: la sesión del navegador va en una cookie httpOnly (JavaScript no la puede leer,
// así que un XSS no puede robar el token). Dura lo mismo que el JWT.
export const SESSION_COOKIE = 'luxor_sesion';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  // en producción solo por https; en local (http://localhost) Safari no guardaría una cookie Secure
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});

export const setSessionCookie = (res, token) =>
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });

export const clearSessionCookie = (res) => res.clearCookie(SESSION_COOKIE, cookieOptions());

// lee una cookie del encabezado Cookie (sin instalar cookie-parser)
const readCookie = (req, name) => {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
};

// el Bearer sigue sirviendo para clientes que no son navegador (pruebas, Postman);
// el navegador usa la cookie
const tokenFromRequest = (req) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Bearer' && token) return token;
  return readCookie(req, SESSION_COOKIE);
};

// Verifica el token (Bearer o cookie de sesión) y adjunta { id, role } en req.user.
export const authenticate = (req, res, next) => {
  const token = tokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'No autenticado.' });
  }
  try {
    const payload = jwt.verify(token, getSecret());
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Sesión inválida o expirada.' });
  }
};

// El usuario autenticado debe coincidir con :paramName de la URL, o tener uno de los roles permitidos.
export const authorizeSelfOrRoles = (paramName, ...allowedRoles) => (req, res, next) => {
  const targetId = String(req.params[paramName]);
  // SFTWRKEY-378: sin id en el token, String(undefined) === "undefined" daba acceso a /user/undefined.
  const isSelf = req.user.id != null && String(req.user.id) === targetId;
  const isAllowedRole = allowedRoles.includes(req.user.role);
  if (!isSelf && !isAllowedRole) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para acceder a este recurso.' });
  }
  next();
};

export const requireRoles = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para realizar esta acción.' });
  }
  next();
};
