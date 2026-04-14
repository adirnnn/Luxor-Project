export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  notes: {
    salida: string;
    corazon: string;
    fondo: string;
  };
};

import CDNIntense from "../assets/products/cdnintense.jpg";
import Khamrah from "../assets/products/lattafaKhamrah.jpg";
import Yara from "../assets/products/lattafaYara.jpg";
import OudMood from "../assets/products/lattafaOudMood.jpg";
import ninePM from "../assets/products/afnan9PM.jpg";
import Rasawi from "../assets/products/rasawiHawas.jpg";
import AmberOud from "../assets/products/amberOudHaramain.jpg";
import Fakhar from "../assets/products/lattafaFakhar.jpg";

export const products: Product[] = [
  {
    id: "club-de-nuit-intense",
    name: "Club de Nuit Intense Man",
    price: 390,
    image: CDNIntense,
    description: "Una fragancia intensa y elegante con carácter masculino.",
    notes: {
      salida: "Limón, piña",
      corazon: "Abedul, jazmín",
      fondo: "Almizcle, ámbar",
    },
  },
  {
    id: "khamrah",
    name: "Lattafa Khamrah",
    price: 390,
    image: Khamrah,
    description: "Dulce, cálida y adictiva. Una de las más populares.",
    notes: {
      salida: "Canela, dátiles",
      corazon: "Praliné, vainilla",
      fondo: "Madera, ámbar",
    },
  },
  {
    id: "yara",
    name: "Lattafa Yara",
    price: 330,
    image: Yara,
    description: "Suave, femenina y moderna.",
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
    image: OudMood,
    description: "Intenso y profundo con esencia oriental.",
    notes: {
      salida: "Especias",
      corazon: "Oud",
      fondo: "Ámbar",
    },
  },
  {
    id: "9pm",
    name: "Afnan 9PM",
    price: 420,
    image: ninePM,
    description: "Dulce, nocturna y seductora.",
    notes: {
      salida: "Manzana, canela",
      corazon: "Lavanda",
      fondo: "Vainilla",
    },
  },
  {
    id: "hawas",
    name: "Rasasi Hawas",
    price: 390,
    image: Rasawi,
    description: "Fresca y moderna con gran proyección.",
    notes: {
      salida: "Bergamota",
      corazon: "Canela",
      fondo: "Almizcle",
    },
  },
  {
    id: "amber-oud",
    name: "Al Haramain Amber Oud",
    price: 570,
    image: AmberOud,
    description: "Lujo puro con carácter fuerte.",
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
    image: Fakhar,
    description: "Elegancia moderna con toque oriental.",
    notes: {
      salida: "Manzana",
      corazon: "Lavanda",
      fondo: "Madera",
    },
  },
];