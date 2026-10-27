import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { PageTitle, Text } from "../components/ui/Typography";
import { ProductCard } from "../features/perfumes/ProductCard";
import { fetchCategories } from "../services/productService";
import type { Category } from "../services/productService";
import { fetchCatalog, fetchBrands } from "../services/catalogService";
import type { CatalogPage } from "../services/catalogService";
import { PageMeta } from "../components/seo/PageMeta";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";

// SFTWRKEY-424: paginación y filtros del catálogo.
// Los filtros viven en la URL (?q=&category=&brand=&minPrice=&maxPrice=&sort=&page=)
// para que se puedan compartir y para que el botón "atrás" funcione.

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "newest", label: "Más recientes" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "name", label: "Nombre (A-Z)" },
];

const selectClass =
  "w-full appearance-none py-3 pl-4 pr-10 rounded-xl border border-primary-gold/40 bg-primary-black text-sm text-primary-champagne focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent transition-all duration-200";
const inputClass =
  "w-full py-3 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-primary-champagne placeholder:text-primary-champagne/40 focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent transition-all duration-200";
const optionStyle = { backgroundColor: "#1A1614", color: "#FDFCFB" };

type Result = { key: string; data?: CatalogPage; error?: boolean };

export default function PerfumesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const key = searchParams.toString();

  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const brand = searchParams.get("brand") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  // Texto del buscador y precios: se escriben localmente y se mandan a la URL después.
  const [text, setText] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  const [minText, setMinText] = useState(minPrice);
  const [maxText, setMaxText] = useState(maxPrice);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Si la URL cambia desde afuera (por ejemplo el buscador del Navbar), se sincroniza el input.
  if (q !== prevQ) {
    setPrevQ(q);
    if (q !== text.trim()) setText(q);
  }

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]));
    fetchBrands().then(setBrands).catch(() => setBrands([]));
    return () => clearTimeout(debounce.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(key);
    fetchCatalog({
      q: params.get("q") ?? "",
      category: params.get("category") ?? "",
      brand: params.get("brand") ?? "",
      minPrice: params.get("minPrice") ?? "",
      maxPrice: params.get("maxPrice") ?? "",
      sort: params.get("sort") ?? "newest",
      page: Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
      pageSize: PAGE_SIZE,
    })
      .then((data) => { if (!cancelled) setResult({ key, data }); })
      .catch(() => { if (!cancelled) setResult({ key, error: true }); });
    return () => { cancelled = true; };
  }, [key]);

  const loading = result?.key !== key;
  const data = result?.key === key ? result.data : undefined;
  const error = result?.key === key && result.error;

  const hasFilters = useMemo(
    () => Boolean(q || category || brand || minPrice || maxPrice),
    [q, category, brand, minPrice, maxPrice]
  );

  // Cambia uno o varios filtros y vuelve a la página 1.
  const updateFilters = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    next.delete("page");
    setSearchParams(next);
  };

  const handleSearchChange = (value: string) => {
    setText(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => updateFilters({ q: value.trim() }), 350);
  };

  const applyPrices = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ minPrice: minText.trim(), maxPrice: maxText.trim() });
  };

  const clearFilters = () => {
    clearTimeout(debounce.current);
    setText("");
    setMinText("");
    setMaxText("");
    setSearchParams(sort !== "newest" ? { sort } : {});
  };

  const goToPage = (n: number) => {
    const next = new URLSearchParams(searchParams);
    if (n <= 1) next.delete("page");
    else next.set("page", String(n));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = data?.totalPages ?? 1;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1
  );

  return (
    <MainLayout>
      <PageMeta title="Catálogo de perfumes" description="Explora nuestro catálogo de perfumes árabes y de diseñador: busca por nombre, marca, categoría o notas olfativas." />
      <Section className="pt-0 pb-20 bg-primary-black">
        <Container>
          <div className="flex flex-col gap-10">
            <div className="max-w-xl flex flex-col gap-4">
              <PageTitle>Nuestros Perfumes</PageTitle>
              <span className="text-[10px] tracking-[0.3em] uppercase text-primary-gold font-bold">Colección</span>
              <Text className="text-primary-champagne/70 text-sm md:text-base leading-relaxed">
                Explora nuestra selección completa de fragancias árabes e internacionales, curadas con la máxima sofisticación y excelencia.
              </Text>
            </div>

            {/* ── Filtros ── */}
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Buscar perfume o marca..."
                  aria-label="Buscar perfume"
                  className={inputClass}
                />

                <select
                  value={category}
                  onChange={(e) => updateFilters({ category: e.target.value })}
                  aria-label="Filtrar por categoría"
                  className={selectClass}
                >
                  <option value="" style={optionStyle}>Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)} style={optionStyle}>{c.nombre}</option>
                  ))}
                </select>

                <select
                  value={brand}
                  onChange={(e) => updateFilters({ brand: e.target.value })}
                  aria-label="Filtrar por marca"
                  className={selectClass}
                >
                  <option value="" style={optionStyle}>Todas las marcas</option>
                  {brands.map((b) => (
                    <option key={b} value={b} style={optionStyle}>{b}</option>
                  ))}
                </select>

                <select
                  value={sort}
                  onChange={(e) => updateFilters({ sort: e.target.value === "newest" ? "" : e.target.value })}
                  aria-label="Ordenar por"
                  className={selectClass}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} style={optionStyle}>{o.label}</option>
                  ))}
                </select>
              </div>

              <form onSubmit={applyPrices} className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={minText}
                  onChange={(e) => setMinText(e.target.value)}
                  placeholder="Precio mín. (Q)"
                  aria-label="Precio mínimo"
                  className={`${inputClass} !w-40`}
                />
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={maxText}
                  onChange={(e) => setMaxText(e.target.value)}
                  placeholder="Precio máx. (Q)"
                  aria-label="Precio máximo"
                  className={`${inputClass} !w-40`}
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl border border-primary-gold/40 text-xs uppercase tracking-[0.2em] text-primary-gold hover:bg-primary-gold hover:text-primary-black transition-colors"
                >
                  Aplicar precio
                </button>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-3 py-3 text-xs uppercase tracking-[0.2em] text-primary-champagne/70 hover:text-primary-gold transition-colors"
                  >
                    Limpiar filtros
                  </button>
                )}
              </form>
            </div>

            {/* ── Loading y error (SFTWRKEY-423: componentes compartidos) ── */}
            {loading && <LoadingSpinner message="Cargando productos..." />}

            {error && <ErrorMessage message="No pudimos cargar el catálogo. Revisa tu conexión e intenta de nuevo en unos minutos." />}

            {/* ── Resultados ── */}
            {!loading && !error && data && (
              <>
                {hasFilters && (
                  <p className="text-sm text-primary-champagne/70 -mt-4">
                    {data.total === 0
                      ? `Sin resultados${q ? ` para "${q}"` : ""}`
                      : `${data.total} resultado${data.total !== 1 ? "s" : ""}${q ? ` para "${q}"` : ""}`}
                  </p>
                )}

                {data.items.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6 lg:gap-8">
                    {data.items.map((product, index) => (
                      <ProductCard
                        key={product.id}
                        priority={index < 4}
                        id={product.id}
                        name={product.name}
                        price={product.price}
                        image={product.image}
                        stock={product.stock}
                        description={product.notes?.corazon}
                      />
                    ))}
                  </div>
                ) : (
                  !hasFilters && (
                    <p className="text-center text-primary-champagne/70 py-20">
                      No hay productos disponibles.
                    </p>
                  )
                )}

                {/* ── Paginación ── */}
                {totalPages > 1 && (
                  <nav aria-label="Paginación del catálogo" className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(page - 1)}
                      disabled={page <= 1}
                      className="px-4 py-2 rounded-xl border border-primary-gold/40 text-xs uppercase tracking-[0.2em] text-primary-champagne disabled:opacity-30 hover:border-primary-gold transition-colors"
                    >
                      Anterior
                    </button>
                    {pageNumbers.map((n, i) => (
                      <span key={n} className="flex items-center gap-2">
                        {i > 0 && n - pageNumbers[i - 1] > 1 && <span className="text-primary-champagne/40">…</span>}
                        <button
                          type="button"
                          onClick={() => goToPage(n)}
                          aria-current={n === page ? "page" : undefined}
                          className={
                            n === page
                              ? "w-10 h-10 rounded-xl bg-primary-gold text-primary-black text-sm font-bold"
                              : "w-10 h-10 rounded-xl border border-white/[0.08] text-sm text-primary-champagne hover:border-primary-gold transition-colors"
                          }
                        >
                          {n}
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages}
                      className="px-4 py-2 rounded-xl border border-primary-gold/40 text-xs uppercase tracking-[0.2em] text-primary-champagne disabled:opacity-30 hover:border-primary-gold transition-colors"
                    >
                      Siguiente
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </Container>
      </Section>
    </MainLayout>
  );
}