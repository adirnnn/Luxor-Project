// backend/seed.js
import pool from './db.js';

const seedUsers = async () => {
  try {
    // Crear tabla si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id        SERIAL PRIMARY KEY,
        name      VARCHAR(100) NOT NULL,
        email     VARCHAR(150) UNIQUE NOT NULL,
        password  VARCHAR(255) NOT NULL,
        role      VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla users lista');

    // Insertar usuarios de prueba
    const users = [
      { name: 'Admin Luxor',  email: 'admin@luxor.com',  password: '123456',  role: 'admin' },
      { name: 'Juan Pérez',   email: 'juan@luxor.com',   password: 'test123', role: 'user'  },
      { name: 'María García', email: 'maria@luxor.com',  password: 'test123', role: 'user'  },
      { name: 'Carlos López', email: 'carlos@luxor.com', password: 'test123', role: 'user'  },
    ];

    for (const user of users) {
      await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [user.name, user.email, user.password, user.role]
      );
    }

    console.log('✅ Usuarios de prueba insertados');

    // Validar: mostrar todos los usuarios insertados
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users');
    console.log('📋 Usuarios en DB:');
    console.table(result.rows);

  } catch (err) {
    console.error('❌ Error en seed:', err.message);
  } finally {
    await pool.end();
  }
};

seedUsers();