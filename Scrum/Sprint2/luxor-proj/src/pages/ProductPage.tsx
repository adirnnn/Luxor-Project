import { useParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { ProductDetail } from "../features/perfumes/ProductDetail";
import { products } from "../data/products";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();

  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <MainLayout>
        <div className="py-20 text-center">Producto no encontrado</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ProductDetail {...product} />
    </MainLayout>
  );
}