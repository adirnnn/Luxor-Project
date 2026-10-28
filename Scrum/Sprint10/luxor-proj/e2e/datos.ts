// SFTWRKEY-456: datos compartidos por las pruebas de extremo a extremo.

// puertos propios para no usar por error un backend que ya esté corriendo con otra base
export const BACKEND_URL = "http://localhost:3100";
export const FRONTEND_URL = "http://localhost:4180";

// el administrador lo crea el seed con estas variables (las mismas de las pruebas de integración)
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "admin@luxor.com",
  password: process.env.ADMIN_PASSWORD ?? "admin-pruebas-integracion",
};

// perfume que se crea solo para estas pruebas, con stock de sobra (ver preparacion.setup.ts)
export const PERFUME = {
  id: "e2e-perfume",
  name: "Perfume Pruebas E2E",
  price: 250,
};

// tarjeta que aprueba la pasarela simulada (backend/services/paymentGateway.js)
export const TARJETA = {
  titular: "Cliente Prueba",
  numero: "4242 4242 4242 4242",
  mes: "12",
  anio: String(new Date().getFullYear() + 2),
  cvv: "123",
  direccion: "Zona 10, Ciudad de Guatemala",
  ciudad: "Guatemala",
  postal: "01010",
  pais: "Guatemala",
};

// correo distinto en cada corrida para poder repetir las pruebas sin borrar la base
export const correoUnico = (prefijo: string) =>
  `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@pruebas-e2e.com`;
