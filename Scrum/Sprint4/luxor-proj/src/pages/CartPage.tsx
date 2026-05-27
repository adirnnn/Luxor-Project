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
        <H1 className="mb-16 text-5xl md:text-7xl font-heading font-black italic text-primary-gold uppercase tracking-tighter">Tu Selección</H1>

        {cart.length === 0 ? (
          <div className="py-24 text-center glass-card p-12 backdrop-blur-3xl">
            <Text className="mb-12 text-primary-champagne/50 text-xl md:text-2xl font-black uppercase tracking-widest">El carrito está vacío.</Text>
            <Link to="/perfumes">
              <Button className="px-16 py-6 font-black uppercase tracking-[0.3em] text-sm shadow-2xl">
                DESCUBRIR FRAGANCIAS
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-6">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-8 p-6 glass-card border-none hover:scale-[1.01] transition-all duration-500 group">
                  <div className="w-28 h-28 bg-primary-black rounded-3xl overflow-hidden p-4 border border-white/5 flex-shrink-0 flex items-center justify-center shadow-inner">
                    <img src={item.product.image} alt={item.product.name} className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <H3 className="text-xl md:text-2xl font-black text-primary-champagne truncate uppercase tracking-tight">{item.product.name}</H3>
                    <span className="text-primary-gold font-black text-lg tracking-widest">Q{item.product.price}</span>
                  </div>
                  <div className="flex items-center gap-6 text-primary-champagne">
                    <button 
                      onClick={() => decrementQuantity(item.product.id)}
                      className="w-10 h-10 flex items-center justify-center border-2 border-white/10 rounded-full hover:border-primary-gold hover:text-primary-gold transition-all font-black text-lg"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-lg font-black">{item.quantity}</span>
                    <button 
                      onClick={() => incrementQuantity(item.product.id)}
                      className="w-10 h-10 flex items-center justify-center border-2 border-white/10 rounded-full hover:border-primary-gold hover:text-primary-gold transition-all font-black text-lg"
                    >
                      +
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-red-500/40 hover:text-red-500 p-3 text-2xl font-black transition-all hover:scale-125"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <div className="glass-card p-10 sticky top-32 border-primary-gold/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
                <H2 className="text-primary-gold mb-8 text-2xl font-black uppercase tracking-[0.2em]">RESUMEN</H2>
                <div className="flex justify-between items-center pt-6 border-t border-white/5 mb-10">
                  <span className="text-primary-champagne/40 text-xs tracking-[0.3em] uppercase font-black">Total Final</span>
                  <span className="text-4xl font-black text-primary-gold tracking-tighter">Q{totalPrice}</span>
                </div>
                <Button className="w-full py-6 font-black uppercase tracking-[0.3em] text-sm shadow-[0_20px_60px_rgba(224,179,84,0.3)]">
                  FINALIZAR COMPRA
                </Button>
              </div>
            </div>
          </div>
        )}
      </Container>
    </MainLayout>
  );
}

