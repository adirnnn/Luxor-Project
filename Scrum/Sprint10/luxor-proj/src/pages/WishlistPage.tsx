import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { PageTitle, Text } from "../components/ui/Typography";
import { ProductCard } from "../features/perfumes/ProductCard";
import { PageMeta } from "../components/seo/PageMeta";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { fetchWishlist } from "../services/wishlistService";
import type { Product } from "../services/productService";

type Result = { userId: number; items?: Product[]; error?: boolean };

// SFTWRKEY-429: página con los perfumes guardados. Solo se llega con sesión (ProtectedRoute).
export default function WishlistPage() {
  const { user } = useAuth();
  const { ids } = useWishlist();
  const userId = user?.id ?? null;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    fetchWishlist(userId)
      .then((items) => { if (!cancelled) setResult({ userId, items }); })
      .catch(() => { if (!cancelled) setResult({ userId, error: true }); });
    return () => { cancelled = true; };
  }, [userId]);

  const mine = result?.userId === userId ? result : null;
  // si quita un corazón en esta misma página, el producto desaparece de la lista al instante
  const items = mine?.items?.filter((p) => ids.has(p.id));

  return (
    <MainLayout>
      <PageMeta title="Lista de deseos" noindex />
      <Section className="pt-0 pb-20 bg-primary-black">
        <Container>
          <div className="flex flex-col gap-10">
            <div className="max-w-xl flex flex-col gap-4">
              <PageTitle>Lista de deseos</PageTitle>
              <Text className="text-primary-champagne/70 text-sm md:text-base">
                Los perfumes que guardaste para comprar después.
              </Text>
            </div>

            {/* SFTWRKEY-423: componentes compartidos de carga y error */}
            {!mine && <LoadingSpinner message="Cargando tu lista..." />}
            {mine?.error && <ErrorMessage message="No pudimos cargar tu lista de deseos. Intenta de nuevo en unos minutos." />}

            {items && items.length === 0 && (
              <div className="flex flex-col items-start gap-6 py-10">
                <p className="text-primary-champagne/70">Todavía no guardaste ningún perfume.</p>
                <Link to="/perfumes" className="text-xs font-black text-primary-gold uppercase tracking-widest hover:text-primary-champagne">
                  Explorar el catálogo
                </Link>
              </div>
            )}

            {items && items.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6 lg:gap-8">
                {items.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    image={product.image}
                    stock={product.stock}
                    ratingAvg={product.rating_avg}
                    ratingCount={product.rating_count}
                    description={product.notes?.corazon}
                  />
                ))}
              </div>
            )}
          </div>
        </Container>
      </Section>
    </MainLayout>
  );
}
