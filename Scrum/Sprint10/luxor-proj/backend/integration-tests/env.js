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
  // SFTWRKEY-445: Recurrente se simula en helpers.js; la llave solo marca la pasarela como configurada
  RECURRENTE_SECRET_KEY: 'sk_test_integracion',
  // SFTWRKEY-446: secreto con el que se firman los webhooks simulados
  RECURRENTE_WEBHOOK_SECRET: 'whsec_Y2xhdmUtZGUtd2ViaG9vay1kZS1wcnVlYmFzISE=',
  ADMIN_EMAIL: 'admin@luxor.com',
  ADMIN_PASSWORD: 'admin-pruebas-integracion',
  // SFTWRKEY-458: clave interna del chatbot (solo para pruebas)
  CHATBOT_INTERNAL_KEY: 'clave-interna-integracion',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
