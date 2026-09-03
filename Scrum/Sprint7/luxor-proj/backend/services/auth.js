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

// Verifica el Bearer token y adjunta { id, role } en req.user.
export const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
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
  const isSelf = String(req.user.id) === targetId;
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
