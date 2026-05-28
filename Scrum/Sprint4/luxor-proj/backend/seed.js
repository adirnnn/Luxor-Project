// backend/seed.js
import pool from './db.js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

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

    // SFTWRKEY-152: Integridad referencial — users con FK a rol
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role INTEGER NOT NULL REFERENCES rol(id_rol) ON DELETE RESTRICT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Fix for existing databases with wrong type
    try {
      // Intentar convertir forzando el tipo
      await pool.query(`ALTER TABLE users ALTER COLUMN role DROP DEFAULT`);
      await pool.query(`ALTER TABLE users ALTER COLUMN role TYPE INTEGER USING role::integer`);
      console.log('Columna role convertida a INTEGER');
    } catch (e) {
      console.log('Nota: Si role ya es INTEGER o tiene datos incompatibles, este paso se ignora.');
    }

    // Asegurar que la FK existe
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD CONSTRAINT users_role_fkey 
        FOREIGN KEY (role) REFERENCES rol(id_rol) ON DELETE RESTRICT
      `);
    } catch (e) {
      // Ignorar si ya existe
    }

    console.log('Tabla users lista (con FK a rol)');

    // Carrito con FK explícitas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

    // SFTWRKEY-159-161: Tabla de productos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        image VARCHAR(500),
        description TEXT,
        stock INTEGER DEFAULT 0,
        salida VARCHAR(200),
        corazon VARCHAR(200),
        fondo VARCHAR(200),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Tabla products lista');

    // Tablas para reportes (SFTWRKEY-163+)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total NUMERIC(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(100) REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL
      );
    `);
    console.log('Tablas de ordenes listas');

    // Insertar productos iniciales
    const initialProducts = [
      { id: 'club-de-nuit-intense', name: 'Club de Nuit Intense Man', price: 390, image: '/src/assets/products/cdnIntense.png', description: 'Fragancia intensa.', stock: 5, salida: 'Limón, piña', corazon: 'Abedul, jazmín', fondo: 'Almizcle, ámbar' },
      { id: 'khamrah', name: 'Lattafa Khamrah', price: 390, image: '/src/assets/products/lattafaKhamrah.png', description: 'Dulce, cálida.', stock: 3, salida: 'Canela, dátiles', corazon: 'Praliné, vainilla', fondo: 'Madera, ámbar' },
      { id: 'yara', name: 'Lattafa Yara', price: 330, image: '/src/assets/products/lattafaYara.png', description: 'Suave, femenina.', stock: 10, salida: 'Frutas tropicales', corazon: 'Rosa, jazmín', fondo: 'Vainilla, almizcle' }
    ];

    for (const p of initialProducts) {
      await pool.query(
        `INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.price, p.image, p.description, p.stock, p.salida, p.corazon, p.fondo]
      );
    }
    console.log('Productos iniciales insertados');

    // SOLO USAR PARA REINICIAR EN CASO DE EMERGENCIA
    // await pool.query(`DELETE FROM users;`);

    // SFTWRKEY-140: Insertar usuarios con contraseñas hasheadas
    const users = [
      { name: 'Admin Luxor',  email: 'admin@luxor.com',  password: '123456',  role: 1 },
      { name: 'Juan Pérez',   email: 'juan@luxor.com',   password: 'test123', role: 3 },
      { name: 'María García', email: 'maria@luxor.com',  password: 'test123', role: 3 },
      { name: 'Carlos López', email: 'carlos@luxor.com', password: 'test123', role: 3 },
    ];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
      await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [user.name, user.email, hashedPassword, user.role]
      );
    }

    console.log('Usuarios de prueba insertados');

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