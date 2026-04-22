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
    id: "1",
    name: "Club de Nuit Intense",
    price: 390,
    image: "https://via.placeholder.com/400x600",
    description: "Una fragancia intensa y sofisticada inspirada en Creed Aventus.",
    notes: {
      salida: "Piña, Abedul, Manzana",
      corazon: "Rosa, Jazmín, Pachulí",
      fondo: "Musgo, Ámbar, Almizcle"
    }
  },
  {
    id: "2",
    name: "Lattafa Khamrah",
    price: 420,
    image: "https://via.placeholder.com/400x600",
    description: "Una fragancia oriental dulce y envolvente con toques de vainilla.",
    notes: {
      salida: "Canela, Cardamomo",
      corazon: "Rosa, Oud, Vainilla",
      fondo: "Sándalo, Almizcle, Ámbar"
    }
  },
  {
    id: "3",
    name: "Yara",
    price: 350,
    image: "https://via.placeholder.com/400x600",
    description: "Una fragancia floral frutal fresca y femenina.",
    notes: {
      salida: "Pera, Bergamota",
      corazon: "Jazmín, Rosa",
      fondo: "Almizcle, Cedro"
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