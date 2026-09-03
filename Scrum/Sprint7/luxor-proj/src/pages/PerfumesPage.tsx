import { useEffect, useState } from "react";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { ProductCard } from "../features/perfumes/ProductCard";
import { fetchProducts, fetchCategories } from "../services/productService";
import type { Product, Category } from "../services/productService";

export default function PerfumesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError("No se pudieron cargar los productos"))
      .finally(() => setLoading(false));

    // SFTWRKEY-275: Cargar categorías para el selector de filtro
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const filtered = products.filter((p) => {
    // Solo se muestran perfumes con stock disponible (busqueda publica).
    const inStock = (p.stock ?? 0) > 0;
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory =
      categoryId === "all" || String(p.category_id) === categoryId;
    return inStock && matchesQuery && matchesCategory;
  });

  return (
    <MainLayout>
      <Section size="lg" className="pt-32 md:pt-40 pb-20 bg-primary-black">
        <Container>
          <div className="flex flex-col gap-16">
            <div className="max-w-xl flex flex-col gap-4">
              <span className="text-[10px] tracking-[0.3em] uppercase text-primary-gold font-bold">Colección</span>
              <H1 className="text-3xl md:text-5xl font-heading font-black text-primary-champagne">Nuestros Perfumes</H1>
              <Text className="text-primary-champagne/70 text-sm md:text-base leading-relaxed">
                Explora nuestra selección completa de fragancias árabes e internacionales, curadas con la máxima sofisticación y excelencia.
              </Text>
            </div>

            {/* ── Buscador ── */}
            <div className="relative max-w-md">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-gold pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar perfume..."
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-primary-champagne placeholder:text-primary-champagne/40 focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* ── Filtro por categoría (SFTWRKEY-275) ── */}
            <div className="max-w-xs relative">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full appearance-none py-3 pl-4 pr-10 rounded-xl border border-primary-gold/40 bg-primary-black text-sm text-primary-champagne focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent transition-all duration-200"
              >
                <option value="all" style={{ backgroundColor: "#1A1614", color: "#FDFCFB" }}>
                  Todas las categorías
                </option>
                {categories.map((c) => (
                  <option
                    key={c.id}
                    value={String(c.id)}
                    style={{ backgroundColor: "#1A1614", color: "#FDFCFB" }}
                  >
                    {c.nombre}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary-gold pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* ── Loading ── */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-32 gap-6">
                <svg
                  className="animate-spin text-primary-gold"
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
                <p className="text-sm text-primary-champagne/70 tracking-wide">Cargando productos...</p>
              </div>
            )}

            {error && <p className="text-center text-red-500">{error}</p>}

            {/* ── Resultados ── */}
            {!loading && !error && (
              <>
                {(query || categoryId !== "all") && (
                  <p className="text-sm text-primary-champagne/70 -mt-6">
                    {filtered.length === 0
                      ? `Sin resultados${query ? ` para "${query}"` : ""}`
                      : `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}${query ? ` para "${query}"` : ""}`}
                  </p>
                )}

                {filtered.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6 lg:gap-8">
                    {filtered.map((product) => (
                      <ProductCard
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        price={product.price}
                        image={product.image}
                        description={product.notes?.corazon}
                      />
                    ))}
                  </div>
                ) : (
                  !query && categoryId === "all" && (
                    <p className="text-center text-primary-champagne/70 py-20">
                      No hay productos disponibles.
                    </p>
                  )
                )}
              </>
            )}
          </div>
        </Container>
      </Section>
    </MainLayout>
  );
}