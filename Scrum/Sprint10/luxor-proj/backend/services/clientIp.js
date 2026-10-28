// SFTWRKEY-453: IP del cliente en producción. Las peticiones del sitio llegan así:
//   navegador → Vercel (rewrite /api) → Cloudflare → Render → este servidor
// y X-Forwarded-For llega como "<visitante>, <Vercel>, <Cloudflare>". La última IP cambia en cada
// petición, así que con "trust proxy" 1 (req.ip) el límite de intentos nunca se activaba (se
// comprobó en producción: 24 logins fallidos seguidos sin un solo 429).
//
// - clientIp: la primera IP de X-Forwarded-For. Vercel la sobrescribe con la IP real del
//   visitante, así que por el sitio no se puede falsificar.
// - connectingIp: la IP que se conectó a Cloudflare (CF-Connecting-IP; Cloudflare no deja que el
//   cliente la cambie). Para quien llama directo a Render es su IP real, aunque invente la primera
//   de X-Forwarded-For; por eso el límite de respaldo de rateLimit.js usa esta.
// En local y en las pruebas no hay Cloudflare ni Vercel: las dos caen en req.ip.
const IP_REGEX = /^[0-9a-fA-F:.]{3,45}$/;

const valida = (ip) => (typeof ip === 'string' && IP_REGEX.test(ip.trim()) ? ip.trim() : null);

export const clientIp = (req) =>
  valida((req.get?.('x-forwarded-for') ?? req.headers?.['x-forwarded-for'] ?? '').split(',')[0]) ?? req.ip;

export const connectingIp = (req) =>
  valida(req.get?.('cf-connecting-ip') ?? req.headers?.['cf-connecting-ip']) ?? req.ip;
