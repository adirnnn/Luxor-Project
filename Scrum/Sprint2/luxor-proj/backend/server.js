import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (email === "admin@luxor.com" && password === "123456") {
    return res.json({
      success: true,
      token: "luxor-token"
    });
  }
  return res.status(401).json({
    success: false,
    message: "Credenciales inválidas"
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});