export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { validatePassword } from './passwordPolicy.js';

export { MIN_PASSWORD_LENGTH } from './passwordPolicy.js';
export const DEFAULT_SALT_ROUNDS = 12;

const DUMMY_HASH = '$2a$12$invalidhashforcomparisononlyx';

// el correo se guarda y se busca en minúsculas: "Ana@Mail.com" y "ana@mail.com" son la misma cuenta
export const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

// SFTWRKEY-401: onLoginFailed guarda el intento fallido
export const createLoginHandler = ({ pool, bcrypt, signToken, setSessionCookie = () => {}, onLoginFailed = async () => {} }) => async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);
  if (!email || !password) return res.status(400).json({ success: false, message: "Requerido" });
  try {
    // LOWER para que entren también las cuentas que se registraron con mayúsculas
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password AS password_hash, r.nombre AS role,
              to_jsonb(u) -> 'email_verified' AS email_verified
       FROM users u JOIN rol r ON u.role = r.id_rol
       WHERE LOWER(u.email) = $1`, [email]
    );
    const storedHash = result.rows.length > 0 ? result.rows[0].password_hash : DUMMY_HASH;
    const match = await bcrypt.compare(password, storedHash);
    if (result.rows.length === 0 || !match) {
      await onLoginFailed({ email, req });
      return res.status(401).json({ success: false, message: "Error" });
    }
    const user = result.rows[0];
    const publicUser = { id: user.id, name: user.name, role: user.role };
    const token = signToken(publicUser);
    // SFTWRKEY-451: el token solo viaja en la cookie httpOnly; en la respuesta no va, así un
    // script en la página (XSS) nunca lo ve
    setSessionCookie(res, token);
    return res.json({ success: true, user: { ...publicUser, emailVerified: user.email_verified !== false } });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
};

// Register con validación de campos y email duplicado
// verification (opcional): { needs(req) → bool, start(user) → promesa } para el correo de confirmación
export const createRegisterHandler = ({ pool, bcrypt, saltRounds = DEFAULT_SALT_ROUNDS, verification = null }) => async (req, res) => {
  const { name, password } = req.body;
  const email = normalizeEmail(req.body.email);

  // Validar que todos los campos estén presentes
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Todos los campos son requeridos." });
  }

  // Validar formato de email
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: "El formato del correo no es válido." });
  }

  // SFTWRKEY-409: política de contraseñas
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ success: false, message: passwordError });
  }

  try {
    const hash = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 3) RETURNING id, name, email',
      [name, email, hash]
    );
    const user = { ...result.rows[0], role: 'CLIENTE' };
    let emailVerified = true;
    let verificationSent = false;
    if (verification?.needs(req)) {
      emailVerified = false;
      await pool.query('UPDATE users SET email_verified = FALSE WHERE id = $1', [user.id]);
      try {
        verificationSent = (await verification.start(user))?.sent === true;
      } catch (err) {
        // la cuenta queda creada igual: desde Mi cuenta se puede pedir otro enlace
        console.error('No se pudo enviar el correo de verificación:', err.message);
      }
    }
    return res.status(201).json({ success: true, user: { ...user, emailVerified }, verificationSent });
  } catch (err) {
    // Detectar email duplicado 
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: "El correo ya está registrado." });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
};
