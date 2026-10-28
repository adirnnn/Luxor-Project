// SFTWRKEY-456: datos compartidos por las pruebas de extremo a extremo.
import os from "node:os";
import path from "node:path";

// puertos propios para no usar por error un backend que ya esté corriendo con otra base
export const BACKEND_URL = "http://localhost:3100";
export const FRONTEND_URL = "http://localhost:4180";
// SFTWRKEY-445: Recurrente simulado (e2e/recurrente-simulado.mjs)
export const RECURRENTE_URL = "http://localhost:3200";

// el administrador lo crea el seed con estas variables (las mismas de las pruebas de integración)
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "admin@luxor.com",
  password: process.env.ADMIN_PASSWORD ?? "admin-pruebas-integracion",
};

// el paso de preparación guarda aquí el token del admin para no iniciar sesión de más
// (el backend permite 10 inicios de sesión por minuto desde una misma IP)
export const ARCHIVO_TOKEN_ADMIN = path.join(os.tmpdir(), "luxor-e2e-token-admin");

// perfume que se crea solo para estas pruebas, con stock de sobra (ver preparacion.setup.ts)
export const PERFUME = {
  id: "e2e-perfume",
  name: "Perfume Pruebas E2E",
  price: 250,
};

// SFTWRKEY-445: la tarjeta se escribe en la página de Recurrente; la tienda solo pide la dirección
export const DIRECCION = {
  direccion: "Zona 10, Ciudad de Guatemala",
  ciudad: "Guatemala",
  postal: "01010",
  pais: "Guatemala",
};

// correo distinto en cada corrida para poder repetir las pruebas sin borrar la base
export const correoUnico = (prefijo: string) =>
  `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@pruebas-e2e.com`;
