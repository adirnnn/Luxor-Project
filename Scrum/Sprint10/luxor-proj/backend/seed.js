// backend/seed.js
import pool from './db.js';
import bcrypt from 'bcryptjs';
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
      console.log('Nota: La FK users.role ya existe o no se pudo crear.');
    }

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

    // Insertar productos iniciales
    // SFTWRKEY-273: category_id asignado según el nombre insertado arriba
    // 1 = Árabe, 2 = Oriental, 3 = Femenino, 4 = Masculino, 5 = Fresco, 6 = Dulce
    const initialProducts = [
      { id: 'club-de-nuit-intense', name: 'Club de Nuit Intense Man', brand: 'Armaf', price: 550, image: '/assets/products/cdnIntense.webp', description: 'Fragancia intensa.', stock: 5, salida: 'Limón, piña', corazon: 'Abedul, jazmín', fondo: 'Almizcle, ámbar', category_id: 4 },
      { id: 'khamrah', name: 'Lattafa Khamrah', brand: 'Lattafa', price: 650, image: '/assets/products/lattafaKhamrah.webp', description: 'Dulce, cálida.', stock: 3, salida: 'Canela, dátiles', corazon: 'Praliné, vainilla', fondo: 'Madera, ámbar', category_id: 6 },
      { id: 'yara', name: 'Lattafa Yara', brand: 'Lattafa', price: 520, image: '/assets/products/lattafaYara.webp', description: 'Suave, femenina.', stock: 10, salida: 'Frutas tropicales', corazon: 'Rosa, jazmín', fondo: 'Vainilla, almizcle', category_id: 3 },
      { id: 'oud-mood', name: 'Lattafa Oud Mood', brand: 'Lattafa', price: 228, image: '/assets/products/lattafaOudMood.webp', description: 'Intenso y profundo con esencia oriental.', stock: 7, salida: 'Especias', corazon: 'Oud', fondo: 'Ámbar', category_id: 2 },
      { id: '9pm', name: 'Afnan 9PM', brand: 'Afnan', price: 650, image: '/assets/products/afnan9PM.webp', description: 'Dulce, nocturna y seductora.', stock: 2, salida: 'Manzana, canela', corazon: 'Lavanda', fondo: 'Vainilla', category_id: 6 },
      { id: 'hawas', name: 'Rasasi Hawas', brand: 'Rasasi', price: 650, image: '/assets/products/rasawiHawas.webp', description: 'Fresca y moderna con gran proyección.', stock: 4, salida: 'Bergamota', corazon: 'Canela', fondo: 'Almizcle', category_id: 5 },
      { id: 'amber-oud', name: 'Al Haramain Amber Oud', brand: 'Al Haramain', price: 1050, image: '/assets/products/amberOudHaramain.webp', description: 'Lujo puro con carácter fuerte.', stock: 6, salida: 'Cítricos', corazon: 'Ámbar', fondo: 'Oud', category_id: 1 },
      { id: 'fakhar', name: 'Lattafa Fakhar', brand: 'Lattafa', price: 390, image: '/assets/products/lattafaFakhar.webp', description: 'Elegancia moderna con toque oriental.', stock: 8, salida: 'Manzana', corazon: 'Lavanda', fondo: 'Madera', category_id: 2 },
    ];

    // si el perfume ya existe solo se actualiza categoria, imagen y marca
    for (const p of initialProducts) {
      await pool.query(
        `INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo, category_id, brand)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, image = EXCLUDED.image, brand = EXCLUDED.brand`,
        [p.id, p.name, p.price, p.image, p.description, p.stock, p.salida, p.corazon, p.fondo, p.category_id, p.brand]
      );
    }
    console.log('Productos iniciales insertados/actualizados con categoría y marca');

    // SFTWRKEY-402: perfumes nuevos (y marcas nuevas: Maison Alhambra, Swiss Arabian, French Avenue)
    // sus fotos estan en public/assets/products (las agrego Javier el 12/10/2026)
    const newProducts = [
      { id: 'asad', name: 'Lattafa Asad', brand: 'Lattafa', price: 500, image: '/assets/products/asad.webp', description: 'Especiada y ambarada, muy masculina.', stock: 6, salida: 'Pimienta negra, tabaco', corazon: 'Café, iris', fondo: 'Ámbar, vainilla', category_id: 4 },
      { id: 'club-de-nuit-woman', name: 'Club de Nuit Woman', brand: 'Armaf', price: 500, image: '/assets/products/Armaf-Club-de-Nuit-Woman.webp', description: 'Floral y elegante para la noche.', stock: 5, salida: 'Naranja, bergamota', corazon: 'Rosa, jazmín', fondo: 'Pachulí, vainilla', category_id: 3 },
      { id: 'mandarin-sky', name: 'Armaf Odyssey Mandarin Sky', brand: 'Armaf', price: 520, image: '/assets/products/Armaf-Odyssey-Mandarin-Sky.webp', description: 'Dulce y cítrica, fácil de llevar.', stock: 8, salida: 'Mandarina, naranja', corazon: 'Caramelo, haba tonka', fondo: 'Ámbar, vetiver', category_id: 6 },
      { id: 'laventure', name: "Al Haramain L'Aventure", brand: 'Al Haramain', price: 360, image: '/assets/products/Al-Haramain-LAventure.webp', description: 'Fresca y cítrica para el día.', stock: 5, salida: 'Limón, bergamota', corazon: 'Elemí, jazmín', fondo: 'Almizcle, ámbar', category_id: 5 },
      { id: 'salvo', name: 'Maison Alhambra Salvo', brand: 'Maison Alhambra', price: 260, image: '/assets/products/Maison-Alhambra-Salvo.webp', description: 'Fresca y aromática, buena para diario.', stock: 10, salida: 'Bergamota, pimienta', corazon: 'Lavanda, geranio', fondo: 'Ambroxan, cedro', category_id: 5 },
      { id: 'shaghaf-oud', name: 'Swiss Arabian Shaghaf Oud', brand: 'Swiss Arabian', price: 480, image: '/assets/products/Swiss-Arabian-Shaghaf-Oud.webp', description: 'Oud dulce con azafrán y rosa.', stock: 4, salida: 'Azafrán, rosa', corazon: 'Praliné, oud', fondo: 'Vainilla, ámbar', category_id: 1 },
      { id: 'liquid-brun', name: 'French Avenue Liquid Brun', brand: 'French Avenue', price: 380, image: '/assets/products/liquid-brun.webp', description: 'Cálida y especiada con vainilla.', stock: 6, salida: 'Canela, cardamomo', corazon: 'Vainilla, elemí', fondo: 'Praliné, guayaco', category_id: 6 },
    ];

    // con DO NOTHING se insertan una sola vez, asi no se pisan los cambios que haga el admin
    let insertados = 0;
    for (const p of newProducts) {
      const result = await pool.query(
        `INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo, category_id, brand)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.price, p.image, p.description, p.stock, p.salida, p.corazon, p.fondo, p.category_id, p.brand]
      );
      // rowCount es 0 cuando el perfume ya existia
      insertados += result.rowCount;
    }
    console.log(`Perfumes nuevos: ${insertados} insertados, ${newProducts.length - insertados} ya existian`);

    // SFTWRKEY-457: las fotos de public/assets/products ahora son .webp (los .png y .jpg se borraron),
    // asi que los productos que ya estaban en la base pasan a la ruta nueva
    const imagenes = await pool.query(
      `UPDATE products SET image = regexp_replace(image, '\\.(png|jpe?g)$', '.webp')
       WHERE image ~ '^/assets/products/[^/]+\\.(png|jpe?g)$'`
    );
    console.log(`Imagenes pasadas a WebP: ${imagenes.rowCount}`);

    // SFTWRKEY-457: fotos que el admin sube desde el panel (ya convertidas a WebP)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Precios corregidos segun el reporte de existencias de enero 2026 (LISTADO DE PERFUME VIC.).
    // Los inserts de arriba no tocan el precio de un perfume que ya existe, por eso se corrige aqui.
    // Solo se cambia si todavia tiene el precio viejo del seed, asi no se pisa un precio que el admin ya cambio.
    const preciosCorregidos = [
      { id: 'club-de-nuit-intense', anterior: 390, nuevo: 550 },
      { id: 'khamrah', anterior: 390, nuevo: 650 },
      { id: 'yara', anterior: 330, nuevo: 520 },
      { id: '9pm', anterior: 420, nuevo: 650 },
      { id: 'hawas', anterior: 390, nuevo: 650 },
      { id: 'amber-oud', anterior: 570, nuevo: 1050 },
      { id: 'asad', anterior: 300, nuevo: 500 },
      { id: 'club-de-nuit-woman', anterior: 350, nuevo: 500 },
      { id: 'mandarin-sky', anterior: 330, nuevo: 520 },
    ];

    let corregidos = 0;
    for (const p of preciosCorregidos) {
      const result = await pool.query(
        `UPDATE products SET price = $2 WHERE id = $1 AND price = $3`,
        [p.id, p.nuevo, p.anterior]
      );
      corregidos += result.rowCount;
    }
    console.log(`Precios corregidos: ${corregidos} de ${preciosCorregidos.length}`);

    // Perfumes agregados desde el reporte de existencias de enero 2026: precio y stock salen del reporte.
    // Todavia no tienen foto, usan sin-imagen.svg hasta que se cambie desde el panel.
    const catalogoEnero2026 = [
      { id: 'khamrah-qahwa', name: 'Lattafa Khamrah Qahwa', brand: 'Lattafa', price: 600, description: 'La Khamrah con café: dulce, especiada y envolvente.', stock: 47, salida: 'Canela, cardamomo, jengibre', corazon: 'Praliné, frutas confitadas', fondo: 'Café, vainilla, haba tonka', category_id: 6 },
      { id: 'yara-moi', name: 'Lattafa Yara Moi', brand: 'Lattafa', price: 500, description: 'Floral y cremosa, más elegante que la Yara clásica.', stock: 12, salida: 'Jazmín, champaca', corazon: 'Ámbar, pachulí', fondo: 'Caramelo, vainilla, almizcle', category_id: 3 },
      { id: 'yara-tous', name: 'Lattafa Yara Tous', brand: 'Lattafa', price: 500, description: 'Tropical y dulce, ideal para el calor.', stock: 11, salida: 'Mango, coco, maracuyá', corazon: 'Jazmín, azahar', fondo: 'Vainilla, almizcle', category_id: 6 },
      { id: 'eclaire', name: 'Lattafa Eclaire', brand: 'Lattafa', price: 600, description: 'Gourmand de caramelo y leche, muy dulce.', stock: 2, salida: 'Caramelo, leche, azúcar', corazon: 'Miel, flores blancas', fondo: 'Vainilla, praliné, almizcle', category_id: 6 },
      { id: 'oud-for-glory', name: 'Lattafa Badee Al Oud for Glory', brand: 'Lattafa', price: 500, description: 'Oud oscuro y especiado de gran duración.', stock: 13, salida: 'Azafrán, nuez moscada, lavanda', corazon: 'Oud, pachulí', fondo: 'Oud, almizcle', category_id: 1 },
      { id: 'club-de-nuit-untold', name: 'Armaf Club de Nuit Untold', brand: 'Armaf', price: 750, description: 'Ambarada y luminosa, se nota a distancia.', stock: 26, salida: 'Azafrán, jazmín', corazon: 'Amberwood, ámbar gris', fondo: 'Resina de abeto, cedro', category_id: 2 },
      { id: 'club-de-nuit-iconic', name: 'Armaf Club de Nuit Iconic', brand: 'Armaf', price: 750, description: 'Fresca y amaderada, versátil para todo el día.', stock: 9, salida: 'Toronja, limón, menta', corazon: 'Jengibre, nuez moscada, jazmín', fondo: 'Incienso, vetiver, cedro', category_id: 4 },
      { id: 'supremacy-silver', name: 'Afnan Supremacy Silver', brand: 'Afnan', price: 650, description: 'Afrutada y ahumada con mucho carácter.', stock: 5, salida: 'Bergamota, piña, grosella negra', corazon: 'Abedul, pachulí, jazmín', fondo: 'Almizcle, ámbar gris, vainilla', category_id: 4 },
      { id: 'eros-parfum', name: 'Versace Eros Parfum', brand: 'Versace', price: 1350, description: 'Versión más profunda y especiada de Eros.', stock: 6, salida: 'Menta, limón, pimienta', corazon: 'Geranio, ambroxan', fondo: 'Vainilla, cedro, vetiver', category_id: 4 },
      { id: 'one-million', name: 'Paco Rabanne 1 Million', brand: 'Paco Rabanne', price: 1450, description: 'Especiada y cuerosa, un clásico de noche.', stock: 2, salida: 'Toronja, menta, mandarina', corazon: 'Rosa, canela', fondo: 'Cuero, ámbar, pachulí', category_id: 4 },
      { id: '212-men', name: 'Carolina Herrera 212 Men', brand: 'Carolina Herrera', price: 1250, description: 'Fresca y limpia para el día a día.', stock: 12, salida: 'Toronja, limón, notas verdes', corazon: 'Jengibre, violeta, gardenia', fondo: 'Almizcle, sándalo, incienso', category_id: 5 },
      { id: 'light-blue', name: 'Dolce & Gabbana Light Blue', brand: 'Dolce & Gabbana', price: 1100, description: 'Cítrica y fresca, perfecta para el verano.', stock: 6, salida: 'Limón siciliano, manzana, cedro', corazon: 'Bambú, jazmín, rosa blanca', fondo: 'Cedro, ámbar, almizcle', category_id: 3 },
      { id: 'dior-homme-intense', name: 'Dior Homme Intense', brand: 'Dior', price: 2100, description: 'Iris empolvado y elegante para la noche.', stock: 2, salida: 'Lavanda', corazon: 'Iris, ambreta, pera', fondo: 'Vetiver, cedro', category_id: 4 },
      { id: 'sauvage-elixir', name: 'Dior Sauvage Elixir', brand: 'Dior', price: 4200, description: 'La versión más concentrada y especiada de Sauvage.', stock: 1, salida: 'Canela, nuez moscada, cardamomo, toronja', corazon: 'Lavanda', fondo: 'Regaliz, sándalo, ámbar, pachulí', category_id: 2 },
      { id: 'erba-pura', name: 'Xerjoff Erba Pura', brand: 'Xerjoff', price: 3500, description: 'Afrutada y luminosa, de perfumería nicho.', stock: 1, salida: 'Naranja, limón, bergamota', corazon: 'Frutas mediterráneas', fondo: 'Almizcle blanco, vainilla, ámbar', category_id: 6 },
    ];

    let agregados = 0;
    for (const p of catalogoEnero2026) {
      const result = await pool.query(
        `INSERT INTO products (id, name, price, image, description, stock, salida, corazon, fondo, category_id, brand)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.price, '/assets/products/sin-imagen.svg', p.description, p.stock, p.salida, p.corazon, p.fondo, p.category_id, p.brand]
      );
      agregados += result.rowCount;
    }
    console.log(`Catalogo enero 2026: ${agregados} insertados, ${catalogoEnero2026.length - agregados} ya existian`);

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
