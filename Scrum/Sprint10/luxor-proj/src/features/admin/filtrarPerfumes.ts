import type { Product } from "../../services/productService";

// sin mayúsculas ni tildes: "lattafa" encuentra "Lattafa" y "arabe" encuentra "Árabe"
const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filtrarPerfumes(productos: Product[], busqueda: string): Product[] {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return productos;
    return productos.filter((p) => {
        const texto = normalizar(`${p.name} ${p.brand ?? ""} ${p.id}`);
        return palabras.every((palabra) => texto.includes(palabra));
    });
}
