import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { RelatedProducts } from "../features/perfumes/RelatedProducts";
import { ProductDetail } from "../features/perfumes/ProductDetail";
import { ProductReviews } from "../features/reviews/ProductReviews";
import { fetchProductById, ProductNotFoundError } from "../services/productService";
import type { Product } from "../services/productService";
import { friendlyError } from "../services/apiClient";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { NotFoundMessage } from "../components/ui/NotFoundMessage";
import { PageMeta } from "../components/seo/PageMeta";
import { productDescription } from "../seo/site";
import { trackViewProduct } from "../utils/analytics";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // SFTWRKEY-423: el perfume no existe (404), distinto de un error de conexión
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- id inválido: se muestra el aviso de inmediato
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    setProduct(null);
    fetchProductById(id)
      .then((data) => {
        // SFTWRKEY-251: Validar que la respuesta tenga los campos esperados
        if (!data || !data.id || !data.name) {
          throw new Error("Respuesta del servidor incompleta.");
        }
        setProduct(data);
        trackViewProduct(String(data.id), data.name);
      })
      .catch((err: unknown) => {
        if (err instanceof ProductNotFoundError) setNotFound(true);
        else setError(friendlyError(err, "No se pudo cargar el producto."));
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <MainLayout>
      {/* SFTWRKEY-435: título con el nombre del perfume y descripción con su marca, notas y precio */}
      {product ? (
        <PageMeta title={product.name} description={productDescription(product)} />
      ) : (
        <PageMeta title={notFound ? "Producto no encontrado" : "Perfume"} noindex={notFound} />
      )}
      {loading && <LoadingSpinner message="Cargando producto..." />}
      {error && <ErrorMessage message={error} />}
      {notFound && (
        <NotFoundMessage
          eyebrow="Producto no encontrado"
          title="Este perfume no está disponible"
          message="No encontramos el perfume que buscas. Puede que el enlace esté mal escrito o que ya no forme parte de nuestra colección."
          linkTo="/perfumes"
          linkLabel="Ver el catálogo"
        />
      )}
      {product && <ProductDetail {...product} />}
      {/* SFTWRKEY-431 */}
      {product && <ProductReviews productId={product.id} />}
      {/* SFTWRKEY-430 */}
      {product && <RelatedProducts productId={product.id} />}
    </MainLayout>
  );
}