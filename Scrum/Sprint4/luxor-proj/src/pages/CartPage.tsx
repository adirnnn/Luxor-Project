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
      <Container className="py-24 md:py-32">
        <H1 className="mb-10 text-3xl md:text-5xl font-heading font-black text-primary-champagne">Tu Carrito</H1>

        {cart.length === 0 ? (
          <div className="py-24 text-center bg-white/[0.01] rounded-3xl border border-white/[0.08] p-8 backdrop-blur-xl">
            <Text className="mb-8 text-primary-champagne/60 text-sm md:text-base">El carrito está actualmente vacío.</Text>
            <Link to="/perfumes">
              <Button className="px-10 py-4 bg-primary-gold text-primary-black font-black uppercase tracking-[0.2em] text-xs rounded-full hover:bg-primary-champagne transition-all shadow-xl">
                Explorar Perfumes
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-6 p-4 bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/[0.08] hover:border-primary-gold/30 transition-all duration-300">
                  <div className="w-20 h-20 bg-white/[0.01] border border-white/[0.05] rounded-xl overflow-hidden p-2 flex-shrink-0 flex items-center justify-center">
                    <img src={item.product.image} alt={item.product.name} className="w-full h-full object-contain drop-shadow-[0_8px_8px_rgba(0,0,0,0.5)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <H3 className="text-sm md:text-base font-heading font-bold text-primary-champagne truncate">{item.product.name}</H3>
                    <span className="text-primary-gold font-bold text-xs tracking-wider">Q{item.product.price}</span>
                  </div>
                  <div className="flex items-center gap-4 text-primary-champagne">
                    <button 
                      onClick={() => decrementQuantity(item.product.id)}
                      className="w-8 h-8 flex items-center justify-center border border-white/[0.1] rounded-full hover:border-primary-gold hover:bg-white/[0.05] transition-colors font-bold"
                    >
                      -
                    </button>
                    <span className="w-4 text-center text-sm font-semibold">{item.quantity}</span>
                    <button 
                      onClick={() => incrementQuantity(item.product.id)}
                      className="w-8 h-8 flex items-center justify-center border border-white/[0.1] rounded-full hover:border-primary-gold hover:bg-white/[0.05] transition-colors font-bold"
                    >
                      +
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-red-400/70 hover:text-red-400 p-2 text-xl font-bold transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl p-8 rounded-3xl sticky top-28 shadow-2xl">
                <H2 className="text-primary-champagne mb-6 text-xl font-heading font-bold uppercase tracking-wider">Resumen</H2>
                <div className="flex justify-between items-center pt-4 border-t border-white/[0.08] mb-8">
                  <span className="text-primary-champagne/60 text-xs tracking-wider uppercase font-semibold">Total</span>
                  <span className="text-2xl font-bold text-primary-gold">Q{totalPrice}.00</span>
                </div>
                <Button className="w-full py-4 bg-primary-gold text-primary-black font-black uppercase tracking-[0.2em] text-xs rounded-full hover:bg-primary-champagne hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
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
