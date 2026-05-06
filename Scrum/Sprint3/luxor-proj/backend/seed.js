// backend/seed.js
import pool from './db.js';

const seedUsers = async () => {
  try {
    // Tabla rol
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rol (
        id_rol SERIAL PRIMARY KEY,
        nombre VARCHAR(20) UNIQUE NOT NULL
      );
    `);

    await pool.query(`
      INSERT INTO rol (nombre)
      VALUES ('ADMIN'), ('VENDEDOR'), ('CLIENTE')
      ON CONFLICT (nombre) DO NOTHING;
    `);

    console.log('Tabla rol lista');

    // Tablas de carrito
    await pool.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
        product_id VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      );
    `);

    console.log('Tablas carrito listas');

    // Limpiar usuarios 
    // SOLO USAR PARA REINICIAR EN CASO DE EMERGENCIA
    // await pool.query(`DELETE FROM users;`);

    // Insertar usuarios de prueba
    const users = [
      { name: 'Admin Luxor',  email: 'admin@luxor.com',  password: '123456', role: 1 }, // 1: Admin
      { name: 'Juan Pérez',   email: 'juan@luxor.com',   password: 'test123', role: 3 }, // 3: cliente
      { name: 'María García', email: 'maria@luxor.com',  password: 'test123', role: 3 },
      { name: 'Carlos López', email: 'carlos@luxor.com', password: 'test123', role: 3 },
    ];

    for (const user of users) {
      await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [user.name, user.email, user.password, user.role]
      );
    }

    console.log('Usuarios de prueba insertados');

    // Verificación de inserción
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, r.nombre AS rol, u.created_at
      FROM users u
      JOIN rol r ON u.role = r.id_rol
    `);

    console.log('Usuarios en DB:');
    console.table(result.rows);

  } catch (err) {
    console.error('Error en seed:', err.message);
  } finally {
    await pool.end();
  }
};

seedUsers();