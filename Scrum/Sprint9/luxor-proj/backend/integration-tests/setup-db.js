// Prepara la base de pruebas: espera a PostgreSQL, corre el seed real del
// proyecto (esquema + datos iniciales) y verifica que haya quedado cargado.
import './env.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

const { Client } = pkg;

const connection = () => new Client({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

async function waitForDatabase(attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    const client = connection();
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (err) {
      await client.end().catch(() => {});
      if (i === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

await waitForDatabase();
console.log(`PostgreSQL listo en ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`);

// seed.js no exporta nada: lanza el seeding al cargarse y no espera su promesa,
// por eso se corre como proceso aparte (hereda las variables de env.js).
const seedPath = fileURLToPath(new URL('../seed.js', import.meta.url));
const seed = spawnSync(process.execPath, [seedPath], { stdio: 'inherit', env: process.env });
if (seed.status !== 0) process.exit(seed.status ?? 1);

// seed.js atrapa sus errores sin cambiar el código de salida: se valida aquí.
const client = connection();
await client.connect();
const { rows: [counts] } = await client.query(`
  SELECT (SELECT COUNT(*) FROM rol)::int        AS roles,
         (SELECT COUNT(*) FROM categories)::int AS categories,
         (SELECT COUNT(*) FROM products)::int   AS products,
         (SELECT COUNT(*) FROM users)::int      AS users
`);
await client.end();

if (Object.values(counts).some((n) => n === 0)) {
  console.error('La base de pruebas quedó incompleta:', counts);
  process.exit(1);
}
console.log('Base de pruebas lista:', counts);
