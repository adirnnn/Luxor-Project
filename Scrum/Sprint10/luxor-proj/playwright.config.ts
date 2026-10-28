import { defineConfig, devices } from "@playwright/test";
import { BACKEND_URL, FRONTEND_URL, ADMIN } from "./e2e/datos";

// SFTWRKEY-456: pruebas de extremo a extremo (un navegador real recorre el sitio).
// Levanta el backend contra la base de pruebas (la misma de las pruebas de integración:
// `npm run test:db:up` y `npm run test:db:seed` en backend/) y un build del frontend.
// Correr con: npm run test:e2e

const enCI = !!process.env.CI;

// base de pruebas: en local el contenedor luxor-test-db, en el CI la del workflow
const baseDePruebas = {
  POSTGRES_HOST: process.env.POSTGRES_HOST ?? "localhost",
  POSTGRES_PORT: process.env.POSTGRES_PORT ?? "5434",
  POSTGRES_USER: process.env.POSTGRES_USER ?? "postgres",
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? "postgres",
  POSTGRES_DB: process.env.POSTGRES_DB ?? "luxor_test",
};

export default defineConfig({
  testDir: "./e2e",
  // un flujo a la vez: comparten el mismo perfume y los límites de intentos por IP del backend
  fullyParallel: false,
  workers: 1,
  forbidOnly: enCI,
  retries: enCI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: enCI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "preparacion", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["preparacion"],
    },
  ],
  webServer: [
    {
      command: "node server.js",
      cwd: "backend",
      url: `${BACKEND_URL}/products`,
      // siempre uno nuevo: así los límites de intentos (en memoria) empiezan en cero
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...baseDePruebas,
        PORT: "3100",
        FRONTEND_URL,
        JWT_SECRET: "e2e-secret",
        PAYMENT_GATEWAY_API_KEY: "sandbox_e2e",
        PAYMENT_GATEWAY_LATENCY_MS: "0",
        ADMIN_EMAIL: ADMIN.email,
        ADMIN_PASSWORD: ADMIN.password,
        // vacía a propósito: en las pruebas nunca se mandan correos de verdad
        RESEND_API_KEY: "",
      },
    },
    {
      // build aparte (dist-e2e) para no pisar el dist normal
      command: "npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 4180 --strictPort",
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { VITE_API_URL: BACKEND_URL },
    },
  ],
});
