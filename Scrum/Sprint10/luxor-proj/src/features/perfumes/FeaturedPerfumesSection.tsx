import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { ProductCard } from "./ProductCard";
import { fetchBestSellers, fetchCategories, type Category, type Product } from "../../services/productService";
import { friendlyError } from "../../services/apiClient";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorMessage } from "../../components/ui/ErrorMessage";

// Feedback del cliente: antes la portada mostraba todo el catálogo. Ahora muestra los 8 más
// vendidos, con pestañas por categoría y un enlace al catálogo completo.
const TODOS = 0;

export const FeaturedPerfumesSection = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState(TODOS);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  // SFTWRKEY-423: antes, si la API fallaba, la sección quedaba vacía sin ningún aviso
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelado = false;
    fetchBestSellers(active || undefined)
      .then((data) => {
        if (cancelado) return;
        setProducts(data);
        setError(null);
        setLoadedFor(active);
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(friendlyError(err, "No se pudieron cargar las fragancias."));
      });
    return () => {
      cancelado = true;
    };
  }, [active]);

  const tabs = [{ id: TODOS, nombre: "Más vendidos" }, ...categories];
  const activeName = tabs.find((t) => t.id === active)?.nombre ?? "Más vendidos";

  return (
    <Section size="lg" id="perfumes" className="bg-primary-black">
      <Container>
        <div className="flex flex-col gap-10">

          <div className="max-w-lg flex flex-col gap-4">
            <H2 className="tracking-tight text-primary-champagne">Los favoritos de nuestros clientes</H2>
            <Text className="text-primary-champagne/80">
              Las fragancias que más se llevan, por categoría.
            </Text>
          </div>

          {/* en celular las pestañas se desplazan de lado en vez de partirse en varias filas */}
          <div role="tablist" aria-label="Categorías de perfumes" className="flex gap-2 overflow-x-auto pb-2 md:flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active === tab.id}
                onClick={() => setActive(tab.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
                  active === tab.id
                    ? "border-primary-gold bg-primary-gold text-primary-black"
                    : "border-white/15 text-primary-champagne/70 hover:border-primary-gold hover:text-primary-champagne"
                }`}
              >
                {tab.nombre}
              </button>
            ))}
          </div>

          <div role="tabpanel" aria-label={activeName}>
            {error ? (
              <ErrorMessage message={error} />
            ) : loadedFor !== active ? (
              <LoadingSpinner message="Cargando fragancias..." />
            ) : products.length === 0 ? (
              <p className="text-primary-champagne/60">Pronto tendremos fragancias en esta categoría.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    stock={product.stock}
                    ratingAvg={product.rating_avg}
                    ratingCount={product.rating_count}
                    description={product.notes ? `${product.notes.salida} · ${product.notes.corazon}` : product.description}
                  />
                ))}
              </div>
            )}
          </div>

          <Link
            to={active ? `/perfumes?category=${active}` : "/perfumes"}
            className="self-center rounded-full border border-primary-gold/40 px-8 py-3 text-xs font-bold uppercase tracking-[0.3em] text-primary-gold transition-colors hover:bg-primary-gold hover:text-primary-black"
          >
            {active ? `Ver todo ${activeName}` : "Ver todo el catálogo"}
          </Link>
        </div>
      </Container>
    </Section>
  );
};
