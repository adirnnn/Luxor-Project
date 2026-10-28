import { useEffect, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Section } from "../../components/ui/Section";
import { Container } from "../../components/ui/Container";
import { H2, Text } from "../../components/ui/Typography";
import { fetchProductReviews, type ProductReviews as Reviews } from "../../services/reviewService";
import { RatingSummary, Stars } from "./StarRating";

// SFTWRKEY-431: reseñas visibles en la ficha del perfume. El comentario se muestra como texto:
// React escapa el HTML, así que un comentario con <script> se ve literal y no se ejecuta.
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });

export const ProductReviews: FC<{ productId: string }> = ({ productId }) => {
  const [result, setResult] = useState<{ productId: string; data?: Reviews; error?: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProductReviews(productId)
      .then((data) => { if (!cancelled) setResult({ productId, data }); })
      .catch(() => { if (!cancelled) setResult({ productId, error: true }); });
    return () => { cancelled = true; };
  }, [productId]);

  const current = result?.productId === productId ? result : null;
  const data = current?.data;

  return (
    <Section id="resenas" className="pt-0 pb-24 scroll-mt-28">
      <Container>
        <div className="flex flex-col gap-8 max-w-3xl">
          <div className="flex flex-col gap-3">
            <H2 className="tracking-tight text-primary-champagne">Reseñas</H2>
            {data && <RatingSummary average={data.average} count={data.count} size="lg" />}
          </div>

          {!current ? (
            <p className="text-sm text-primary-champagne/50">Cargando reseñas...</p>
          ) : current.error ? (
            <p className="text-sm text-primary-champagne/50">No pudimos cargar las reseñas en este momento.</p>
          ) : data && data.reviews.length > 0 ? (
            <ul className="flex flex-col divide-y divide-white/5 glass-card border-white/5 px-6">
              {data.reviews.map((review) => (
                <li key={review.id} className="flex flex-col gap-2 py-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Stars value={review.rating} size="sm" />
                    <span className="text-xs text-primary-champagne/40">{formatDate(review.created_at)}</span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-primary-champagne/80 whitespace-pre-line break-words">{review.comment}</p>
                  )}
                  <span className="text-xs font-bold uppercase tracking-widest text-primary-gold/80">{review.author}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Text className="text-base">Este perfume todavía no tiene reseñas.</Text>
          )}

          <p className="text-xs text-primary-champagne/50">
            Solo los clientes que ya recibieron este perfume pueden calificarlo. Si lo compraste, califícalo desde{" "}
            <Link to="/mi-cuenta" className="text-primary-gold underline underline-offset-2 hover:text-primary-champagne">Mi cuenta</Link>.
          </p>
        </div>
      </Container>
    </Section>
  );
};
