export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  stock?: number;
  notes: {
    salida: string;
    corazon: string;
    fondo: string;
  };
};

// SFTWRKEY-457: las fotos ahora son .webp en public/assets/products
export const products: Product[] = [
  {
    id: "club-de-nuit-intense",
    name: "Club de Nuit Intense Man",
    price: 550,
    image: "/assets/products/cdnIntense.webp",
    description: "Una fragancia intensa y elegante con carácter masculino.",
    stock: 5,
    notes: {
      salida: "Limón, piña",
      corazon: "Abedul, jazmín",
      fondo: "Almizcle, ámbar",
    },
  },
  {
    id: "khamrah",
    name: "Lattafa Khamrah",
    price: 650,
    image: "/assets/products/lattafaKhamrah.webp",
    description: "Dulce, cálida y adictiva. Una de las más populares.",
    stock: 3,
    notes: {
      salida: "Canela, dátiles",
      corazon: "Praliné, vainilla",
      fondo: "Madera, ámbar",
    },
  },
  {
    id: "yara",
    name: "Lattafa Yara",
    price: 520,
    image: "/assets/products/lattafaYara.webp",
    description: "Suave, femenina y moderna.",
    stock: 10,
    notes: {
      salida: "Frutas tropicales",
      corazon: "Rosa, jazmín",
      fondo: "Vainilla, almizcle",
    },
  },
  {
    id: "oud-mood",
    name: "Lattafa Oud Mood",
    price: 228,
    image: "/assets/products/lattafaOudMood.webp",
    description: "Intenso y profundo con esencia oriental.",
    stock: 7,
    notes: {
      salida: "Especias",
      corazon: "Oud",
      fondo: "Ámbar",
    },
  },
  {
    id: "9pm",
    name: "Afnan 9PM",
    price: 650,
    image: "/assets/products/afnan9PM.webp",
    description: "Dulce, nocturna y seductora.",
    stock: 2,
    notes: {
      salida: "Manzana, canela",
      corazon: "Lavanda",
      fondo: "Vainilla",
    },
  },
  {
    id: "hawas",
    name: "Rasasi Hawas",
    price: 650,
    image: "/assets/products/rasawiHawas.webp",
    description: "Fresca y moderna con gran proyección.",
    stock: 4,
    notes: {
      salida: "Bergamota",
      corazon: "Canela",
      fondo: "Almizcle",
    },
  },
  {
    id: "amber-oud",
    name: "Al Haramain Amber Oud",
    price: 1050,
    image: "/assets/products/amberOudHaramain.webp",
    description: "Lujo puro con carácter fuerte.",
    stock: 6,
    notes: {
      salida: "Cítricos",
      corazon: "Ámbar",
      fondo: "Oud",
    },
  },
  {
    id: "fakhar",
    name: "Lattafa Fakhar",
    price: 390,
    image: "/assets/products/lattafaFakhar.webp",
    description: "Elegancia moderna con toque oriental.",
    stock: 8,
    notes: {
      salida: "Manzana",
      corazon: "Lavanda",
      fondo: "Madera",
    },
  },
];