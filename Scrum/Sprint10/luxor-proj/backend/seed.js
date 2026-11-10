// backend/seed.js
import pool from './db.js';
import bcrypt from 'bcryptjs';
import { ensureRestockAlertsTable } from './services/restockAlerts.js';
import { seedCatalog, removeRetired } from './services/catalogSeed.js';
const isProduction = process.env.NODE_ENV === 'production';

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador';

  if (!email || !password) {
    const aviso = 'ADMIN_EMAIL o ADMIN_PASSWORD no estan definidas: no se crea el administrador';
    if (isProduction) console.warn(`AVISO: ${aviso}.`);
    else console.log(`Nota: ${aviso} (definirlas en el .env para tener un admin local).`);
    return;
  }

  const existing = await pool.query('SELECT id, password FROM users WHERE email = $1', [email]);

  if (existing.rows.length === 0) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 1)',
      [name, email, hashedPassword]
    );
    console.log(`Administrador ${email} creado`);
    return;
  }

  const { id, password: storedHash } = existing.rows[0];
  if (await bcrypt.compare(password, storedHash)) {
    await pool.query('UPDATE users SET role = 1 WHERE id = $1', [id]);
    console.log(`Administrador ${email} ya existia`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  await pool.query('UPDATE users SET password = $1, role = 1 WHERE id = $2', [hashedPassword, id]);
  console.log(`Administrador ${email}: contraseña actualizada desde ADMIN_PASSWORD`);
};

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
      VALUES ('ADMIN'), ('VENDEDOR'), ('CLIENTE'), ('MAYORISTA')
      ON CONFLICT (nombre) DO NOTHING;
    `);

    // Feedback del cliente: ajustes de la tienda que cambia el admin (por ahora, el porcentaje
    // de descuento de los mayoristas; services/wholesale.js usa 10 % si no hay ninguno guardado)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL
      );
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
      console.log('Nota: La FK users.role ya existe o no se pudo crear.');
    }

    // verificación del correo: las cuentas que ya existen cuentan como verificadas (DEFAULT TRUE);
    // solo el registro desde la tienda la pone en FALSE (services/emailVerification.js)
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE');

    console.log('Tabla users lista (con FK a rol)');

    // SFTWRKEY-274: Tabla categorías
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL
      );
    `);

    await pool.query(`
      INSERT INTO categories (nombre)
      VALUES ('Árabe'), ('Oriental'), ('Femenino'), ('Masculino'), ('Fresco'), ('Dulce')
      ON CONFLICT (nombre) DO NOTHING;
    `);

    console.log('Tabla categories lista');

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
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        brand VARCHAR(150),
        external_source VARCHAR(50),
        external_id VARCHAR(100),
        synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Tabla products lista');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_imports (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        total_rows INTEGER NOT NULL,
        imported_rows INTEGER NOT NULL DEFAULT 0,
        rejected_rows INTEGER NOT NULL DEFAULT 0,
        errors JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabla de historial de importaciones lista');
    // SFTWRKEY-274: Asegurar columna category_id en bases ya existentes (creadas antes de este cambio)
    try {
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL`);
      console.log('Columna category_id verificada en products');
    } catch (e) {
      console.log('Nota: no se pudo verificar category_id (probablemente ya existe).');
    }

    
    // integracion PerfumAPI: marca + metadatos de sincronizacion (columnas nuevas en bases ya existentes)
    
    try {
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(150)`);
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS external_source VARCHAR(50)`);
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id VARCHAR(100)`);
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP`);
      console.log('Columnas de integracion PerfumAPI verificadas en products (brand, external_source, external_id, synced_at)');
    } catch (e) {
      console.log('Nota: no se pudieron verificar las columnas de PerfumAPI (probablemente ya existen).');
    }

    
    try {
      await pool.query(`ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0)`);
      console.log('CHECK de price >= 0 agregado en products');
    } catch (e) {
      console.log('Nota: el CHECK de price ya existía.');
    }
    try {
      await pool.query(`ALTER TABLE products ADD CONSTRAINT products_stock_check CHECK (stock >= 0)`);
      console.log('CHECK de stock >= 0 agregado en products');
    } catch (e) {
      console.log('Nota: el CHECK de stock ya existía.');
    }

    
    try {
      const orphans = await pool.query(`DELETE FROM cart_items WHERE product_id NOT IN (SELECT id FROM products)`);
      if (orphans.rowCount > 0) {
        console.log(`Se limpiaron ${orphans.rowCount} items de carrito huérfanos (sin producto asociado)`);
      }
      await pool.query(`ALTER TABLE cart_items ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE`);
      console.log('FK real de cart_items.product_id -> products agregada');
    } catch (e) {
      console.log('Nota: la FK de cart_items.product_id ya existía.');
    }


    // Tablas para reportes (SFTWRKEY-163+)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total NUMERIC(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- SFTWRKEY-449: el total ya incluye el envío; aquí queda cuánto fue y a dónde se entrega.
      -- delivery_address: la dirección (envío a domicilio) o el local (recoger en tienda).
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(10);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address JSONB;
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

    // SFTWRKEY-417: estados del pedido (pagado, en_preparacion, enviado, entregado, cancelado).
    // Los estados validos estan tambien en services/orderStatus.js.
    // Primero se migran los datos y despues se pone el CHECK, si no el CHECK falla.
    await pool.query(`UPDATE orders SET status = 'pagado' WHERE status = 'completed'`);
    // lo que no sea un estado valido (por ejemplo 'pending') nunca se cobro, queda cancelado
    await pool.query(`
      UPDATE orders SET status = 'cancelado'
      WHERE status IS NULL OR status NOT IN ('pagado', 'en_preparacion', 'enviado', 'entregado', 'cancelado')
    `);
    await pool.query(`ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pagado'`);
    try {
      await pool.query(`
        ALTER TABLE orders ADD CONSTRAINT orders_status_check
        CHECK (status IN ('pagado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'))
      `);
      console.log('CHECK de status agregado en orders');
    } catch (e) {
      console.log('Nota: el CHECK de status ya existía.');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        from_status VARCHAR(20),
        to_status VARCHAR(20) NOT NULL,
        changed_by INTEGER REFERENCES users(id),
        changed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    // los pedidos que ya existian reciben su primera fila con la fecha en que se crearon
    await pool.query(`
      INSERT INTO order_status_history (order_id, from_status, to_status, changed_at)
      SELECT o.id, NULL, o.status, COALESCE(o.created_at, NOW())
      FROM orders o
      WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id)
    `);
    console.log('Estados de pedidos e historial listos');

    // SFTWRKEY-419: la vista de pedidos del admin lee los datos del invitado de aqui.
    // commerce.js la crea solo cuando alguien entra a sus rutas; se crea tambien aqui
    // para que exista desde el arranque. Tiene que ser igual a la de migrate() en commerce.js.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guest_receipts (
        key_hash TEXT PRIMARY KEY,
        request_hash TEXT NOT NULL,
        order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
        guest_name VARCHAR(100) NOT NULL,
        guest_email VARCHAR(150) NOT NULL,
        address JSONB NOT NULL,
        response JSONB NOT NULL
      );
    `);

    // SFTWRKEY-417: el aviso de pedido nuevo al admin (trigger de commerce.js) buscaba
    // 'completed'. Se actualiza aqui porque el seed corre antes del server en cada deploy;
    // si no, los pedidos 'pagado' no avisan hasta que alguien entra a una ruta de commerce.
    // Tiene que ser igual a la de migrate() en commerce.js.
    await pool.query(`
      CREATE OR REPLACE FUNCTION luxor_notify_order()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.status = 'pagado' THEN
          INSERT INTO admin_order_events(order_id)
          VALUES (NEW.id)
          ON CONFLICT (order_id) DO NOTHING;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Catálogo base: está en data/catalogo.js y lo carga services/catalogSeed.js. Solo crea los
    // perfumes que faltan (los que ya existen no se tocan) y pone las fotos del catálogo, por ejemplo
    // links de Cloudinary, solo donde todavía está la de relleno o una foto local del sitio.
    const catalogoBase = await seedCatalog(pool);
    console.log(`Catálogo: ${catalogoBase.insertados} perfumes nuevos de ${catalogoBase.total}, ${catalogoBase.fotos} fotos actualizadas`);
    // perfumes que se quitaron del sitio por no tener foto (data/catalogoRetirados.js)
    const retirados = await removeRetired(pool);
    console.log(`Catálogo: ${retirados.borrados} perfumes sin foto retirados`);

    // SFTWRKEY-457: las fotos de public/assets/products ahora son .webp (los .png y .jpg se borraron),
    // asi que los productos que ya estaban en la base pasan a la ruta nueva
    const imagenes = await pool.query(
      `UPDATE products SET image = regexp_replace(image, '\\.(png|jpe?g)$', '.webp')
       WHERE image ~ '^/assets/products/[^/]+\\.(png|jpe?g)$'`
    );
    console.log(`Imagenes pasadas a WebP: ${imagenes.rowCount}`);

    // Feedback del cliente: foto de perfil (WebP de 256 px, una por usuario). Es privada: solo la ve
    // su dueño o un admin (routes/avatars.js), por eso no va en product_images, que es pública.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_avatars (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data BYTEA NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // SFTWRKEY-457: fotos que el admin sube desde el panel (ya convertidas a WebP)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);


    // SFTWRKEY-431: reseñas. Solo de un pedido entregado del cliente, una por perfume de cada pedido.
    // El largo del comentario tiene que ser igual a COMMENT_MAX_LENGTH de routes/reviews.js.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment VARCHAR(500),
        hidden BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (order_id, product_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS reviews_product_id_idx ON reviews (product_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews (user_id)`);

    // promedio y cantidad de reseñas visibles guardados en el producto: así la tarjeta y la ficha
    // los reciben en el mismo SELECT p.* de siempre. routes/reviews.js los recalcula al publicar u ocultar.
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3, 2)`);
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0`);
    // se recalculan todos por si alguna reseña se cambió directo en la base
    await pool.query(`
      UPDATE products p
      SET rating_count = COALESCE(r.total, 0), rating_avg = r.promedio
      FROM products base
      LEFT JOIN (
        SELECT product_id, COUNT(*)::int AS total, ROUND(AVG(rating), 2) AS promedio
        FROM reviews
        WHERE hidden = FALSE
        GROUP BY product_id
      ) r ON r.product_id = base.id
      WHERE p.id = base.id
    `);

    // SFTWRKEY-432: cupones de descuento. Las reglas (vencimiento, límite de usos, compra mínima,
    // un uso por cliente) están en services/coupons.js; el descuento siempre lo calcula el servidor.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(30) UNIQUE NOT NULL,
        discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('porcentaje', 'monto')),
        value NUMERIC(10, 2) NOT NULL CHECK (value > 0),
        min_purchase NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_purchase >= 0),
        max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
        expires_at TIMESTAMPTZ NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (discount_type <> 'porcentaje' OR value <= 100)
      )
    `);
    // Cada uso. Se aparta ('reservado') al abrir el pago, pasa a 'usado' cuando Recurrente confirma
    // el cobro y a 'liberado' si el pago se cancela; los liberados ya no cuentan para el límite.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coupon_uses (
        id SERIAL PRIMARY KEY,
        coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
        session_id UUID UNIQUE,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        guest_email VARCHAR(150),
        discount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'reservado' CHECK (status IN ('reservado', 'usado', 'liberado')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS coupon_uses_coupon_status_idx ON coupon_uses (coupon_id, status)`);
    // el pedido guarda cuánto se descontó y con qué cupón (el total ya viene rebajado)
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(30)`);
    console.log('Tablas coupons y coupon_uses listas');

    // SFTWRKEY-450: "Avísame cuando vuelva". Cada fila es un correo que pidió aviso para un perfume agotado.
    await ensureRestockAlertsTable(pool);
    console.log('Tabla restock_alerts lista');
    console.log('Tabla reviews y promedio de calificaciones listos');

    // SOLO USAR PARA REINICIAR EN CASO DE EMERGENCIA
    // await pool.query(`DELETE FROM users;`);
    // SFTWRKEY-407: el administrador sale de ADMIN_EMAIL y ADMIN_PASSWORD, ya no esta fijo aqui.
    await seedAdmin();

    if (isProduction) {
      // SEC-50: borra los clientes de prueba que se crearon en producción antes de SFTWRKEY-407.
      // Solo si siguen siendo clientes sin pedidos, para no tocar cuentas reales.
      const removed = await pool.query(
        `DELETE FROM users u
         WHERE u.email IN ('juan@luxor.com', 'maria@luxor.com', 'carlos@luxor.com')
           AND u.role = 3
           AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)`
      );
      if (removed.rowCount > 0) console.log(`SEC-50: ${removed.rowCount} clientes de prueba borrados`);
      console.log('Produccion: no se crean los clientes de prueba');
    } else {
      const users = [
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
    }

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
