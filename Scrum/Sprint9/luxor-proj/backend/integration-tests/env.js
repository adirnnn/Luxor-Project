// Variables del entorno de pruebas de integración/regresión.
// Se importa antes que db.js: dotenv no pisa variables ya definidas, así que el
// .env local (que puede apuntar a la base de producción) nunca se usa aquí.
// En CI el workflow define estos valores; localmente apuntan al contenedor
// luxor-test-db (npm run test:db:up).
const defaults = {
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5434',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASSWORD: 'postgres',
  POSTGRES_DB: 'luxor_test',
  JWT_SECRET: 'integration-test-secret',
  PAYMENT_GATEWAY_API_KEY: 'sandbox_integration_key',
  PAYMENT_GATEWAY_LATENCY_MS: '0',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
