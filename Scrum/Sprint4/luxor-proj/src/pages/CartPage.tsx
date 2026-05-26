import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { H1, H2, H3, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useCart } from "../context/CartContext";
import { Link } from "react-router-dom";

export default function CartPage() {
  const { cart, totalPrice, incrementQuantity, decrementQuantity, removeFromCart } = useCart();

  return (
    <MainLayout>
      <Container className="py-12">
        <H1 className="mb-8">Tu Carrito</H1>

        {cart.length === 0 ? (
          <div className="py-20 text-center bg-white/30 rounded-3xl border border-primary-beige">
            <Text className="mb-6">El carrito está vacío.</Text>
            <Link to="/perfumes">
              <Button>Explorar Perfumes</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-6 p-4 bg-white/70 rounded-2xl border border-primary-beige">
                  <div className="w-20 h-20 bg-primary-champagne rounded-lg overflow-hidden p-2 flex-shrink-0">
                    <img src={item.product.image} alt={item.product.name} className="w-full h-full object-contain mix-blend-multiply" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <H3 className="text-sm md:text-base truncate">{item.product.name}</H3>
                    <span className="text-primary-gold font-bold">Q{item.product.price}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => decrementQuantity(item.product.id)}
                      className="w-8 h-8 flex items-center justify-center border border-primary-beige rounded-full hover:bg-primary-beige transition-colors"
                    >
                      -
                    </button>
                    <span className="w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => incrementQuantity(item.product.id)}
                      className="w-8 h-8 flex items-center justify-center border border-primary-beige rounded-full hover:bg-primary-beige transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-red-400 hover:text-red-600 p-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="bg-primary-black text-white p-8 rounded-3xl sticky top-28 shadow-xl">
                <H2 className="text-white mb-6 text-2xl">Resumen</H2>
                <div className="flex justify-between items-center pt-4 border-t border-white/10 mb-8">
                  <Text className="text-white/70">Total</Text>
                  <span className="text-2xl font-bold">Q{totalPrice}.00</span>
                </div>
                <Button className="w-full bg-primary-gold text-primary-black border-none hover:bg-white transition-colors">
                  Finalizar Compra
                </Button>
              </div>
            </div>
          </div>
        )}
      </Container>
    </MainLayout>
  );
}
