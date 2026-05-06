import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5173'
}));
app.use(express.json());

const products = [
  {
    id: "club-de-nuit-intense",
    name: "Club de Nuit Intense Man",
    price: 390,
    image: "/src/assets/products/cdnIntense.png",
    description: "Una fragancia intensa y elegante con carácter masculino.",
    notes: {
      salida: "Limón, piña",
      corazon: "Abedul, jazmín",
      fondo: "Almizcle, ámbar"
    }
  },
  {
    id: "khamrah",
    name: "Lattafa Khamrah",
    price: 390,
    image: "/src/assets/products/lattafaKhamrah.png",
    description: "Dulce, cálida y adictiva. Una de las más populares.",
    notes: {
      salida: "Canela, dátiles",
      corazon: "Praliné, vainilla",
      fondo: "Madera, ámbar"
    }
  },
  {
    id: "yara",
    name: "Lattafa Yara",
    price: 330,
    image: "/src/assets/products/lattafaYara.png",
    description: "Suave, femenina y moderna.",
    notes: {
      salida: "Frutas tropicales",
      corazon: "Rosa, jazmín",
      fondo: "Vainilla, almizcle"
    }
  },
  {
    id: "oud-mood",
    name: "Lattafa Oud Mood",
    price: 228,
    image: "/src/assets/products/lattafaOudMood.png",
    description: "Intenso y profundo con esencia oriental.",
    notes: {
      salida: "Especias",
      corazon: "Oud",
      fondo: "Ámbar"
    }
  },
  {
    id: "9pm",
    name: "Afnan 9PM",
    price: 420,
    image: "/src/assets/products/afnan9PM.png",
    description: "Dulce, nocturna y seductora.",
    notes: {
      salida: "Manzana, canela",
      corazon: "Lavanda",
      fondo: "Vainilla"
    }
  },
  {
    id: "hawas",
    name: "Rasasi Hawas",
    price: 390,
    image: "/src/assets/products/rasawiHawas.png",
    description: "Fresca y moderna con gran proyección.",
    notes: {
      salida: "Bergamota",
      corazon: "Canela",
      fondo: "Almizcle"
    }
  },
  {
    id: "amber-oud",
    name: "Al Haramain Amber Oud",
    price: 570,
    image: "/src/assets/products/amberOudHaramain.png",
    description: "Lujo puro con carácter fuerte.",
    notes: {
      salida: "Cítricos",
      corazon: "Ámbar",
      fondo: "Oud"
    }
  },
  {
    id: "fakhar",
    name: "Lattafa Fakhar",
    price: 390,
    image: "/src/assets/products/lattafaFakhar.png",
    description: "Elegancia moderna con toque oriental.",
    notes: {
      salida: "Manzana",
      corazon: "Lavanda",
      fondo: "Madera"
    }
  }
];

app.get("/", (req, res) => {
  res.send("Backend Luxor funcionando");
});

app.get("/products", (req, res) => {
  res.json(products);
});

app.get("/products/:id", (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Producto no encontrado" });
  }
  res.json(product);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Validaciones
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Correo y contraseña son requeridos." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "El formato del correo no es válido." });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 6 caracteres." });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, r.nombre AS role
      FROM users u
      JOIN rol r ON u.role = r.id_rol
      WHERE u.email = $1 AND u.password = $2`,
      [email, password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }
    const user = result.rows[0];
    return res.json({ success: true, token: "luxor-token", user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error de servidor" });
  }
});

// Endpoint para recuperar el carrito
app.get("/cart/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const cartResult = await pool.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) {
      return res.json([]);
    }
    const cartId = cartResult.rows[0].id;
    const itemsResult = await pool.query('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [cartId]);
    res.json(itemsResult.rows);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener carrito" });
  }
});

// Endpoint para guardar/sincronizar el carrito
app.post("/cart/:userId", async (req, res) => {
  const userId = req.params.userId;
  const items = req.body; // Array de { product_id, quantity }
  try {
    // Verificar si el usuario existe
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Buscar o crear carrito
    let cartResult = await pool.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    let cartId;
    if (cartResult.rows.length === 0) {
      cartResult = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
    }
    cartId = cartResult.rows[0].id;

    // Limpiar items viejos
    await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    // Insertar nuevos items
    if (items && items.length > 0) {
      for (const item of items) {
        await pool.query(
          'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
          [cartId, item.product_id, item.quantity]
        );
      }
    }
    res.json({ success: true, message: "Carrito guardado exitosamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al guardar carrito" });
  }
});

app.get("/report", async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const totalUsers = parseInt(usersResult.rows[0].total);

    const cartItemsResult = await pool.query(`
      SELECT ci.product_id, SUM(ci.quantity) as total_quantity
      FROM cart_items ci
      GROUP BY ci.product_id
      ORDER BY total_quantity DESC
      LIMIT 5
    `);

    const totalItemsResult = await pool.query('SELECT SUM(quantity) as total FROM cart_items');
    const totalItemsInCarts = parseInt(totalItemsResult.rows[0].total) || 0;

    return res.json({
      success: true,
      data: {
        totalUsers,
        totalItemsInCarts,
        topProducts: cartItemsResult.rows,
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Error al generar reporte" });
  }
});

// Endpoint para registrar nuevo usuario
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "Nombre, correo y contraseña son requeridos." });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 6 caracteres." });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Ya existe una cuenta con ese correo." });
    }

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, password, 3]
    );

    const newUser = result.rows[0];
    return res.status(201).json({
      success: true,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Error al registrar usuario." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});