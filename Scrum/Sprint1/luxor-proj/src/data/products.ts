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

export const products: Product[] = [
  {
    id: "oud-royal",
    name: "Oud Royal",
    price: 120,
    image:
      "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?q=80&w=1600&auto=format&fit=crop",
    description:
      "Una fragancia profunda y envolvente diseñada para dejar una impresión duradera. Intensa, elegante y memorable.",
    notes: {
      salida: "Azafrán, bergamota",
      corazon: "Oud, rosa",
      fondo: "Ámbar, almizcle",
    },
  },
  {
    id: "amber-noir",
    name: "Amber Noir",
    price: 95,
    image:
      "https://images.unsplash.com/photo-1615634260167-c8cdede054de?q=80&w=1600&auto=format&fit=crop",
    description:
      "Cálida y sofisticada, una fragancia que envuelve con carácter y profundidad.",
    notes: {
      salida: "Mandarina, especias",
      corazon: "Ámbar, cuero",
      fondo: "Vainilla, madera",
    },
  },
  {
    id: "desert-rose",
    name: "Desert Rose",
    price: 110,
    image:
      "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=1600&auto=format&fit=crop",
    description:
      "Elegante y floral, diseñada para destacar con suavidad y presencia.",
    notes: {
      salida: "Rosa, frutos rojos",
      corazon: "Jazmín, peonía",
      fondo: "Almizcle, ámbar suave",
    },
  },
];