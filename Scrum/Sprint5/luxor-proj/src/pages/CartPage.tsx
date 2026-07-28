import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { H1, H3, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function CartPage() {
  const { cart, totalPrice, incrementQuantity, decrementQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const outOfStockItems = cart.filter(
    (item) => item.product.stock !== undefined && item.quantity > item.product.stock
  );
  const hasStockIssue = outOfStockItems.length > 0;
  const handleGoToPayment = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (hasStockIssue) return;
    navigate("/pago");
  };
  return (
    <MainLayout>
      <Container className="py-24 md:py-32 px-4 md:px-6">
        <H1 className="mb-8 md:mb-16 text-4xl md:text-7xl font-heading font-black italic text-primary-gold uppercase tracking-tighter">
          Tu Selección
        </H1>
        {cart.length === 0 ? (
          <div className="py-16 md:py-24 text-center glass-card p-8 md:p-12 backdrop-blur-3xl">
            <Text className="mb-8 text-primary-champagne/50 text-base md:text-2xl font-black uppercase tracking-widest">
              El carrito está vacío.
            </Text>
            <Link to="/perfumes">
              <Button className="px-10 md:px-16 py-4 md:py-6 font-black uppercase tracking-[0.3em] text-sm shadow-2xl">
                DESCUBRIR FRAGANCIAS
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-12">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <AnimatePresence initial={false}>
                {cart.map((item) => {
                  const itemHasStockIssue =
                    item.product.stock !== undefined && item.quantity > item.product.stock;
                  return (
                  <motion.div
                    key={item.product.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40, transition: { duration: 0.25 } }}
                    transition={{ duration: 0.3 }}
                    className={
                      itemHasStockIssue
                        ? "glass-card p-4 md:p-6 border border-red-500/30 bg-red-500/5"
                        : "glass-card border-none p-4 md:p-6"
                    }
                  >
                    <div className="flex items-start gap-4">
                      <Link
                        to={`/producto/${item.product.id}`}
                        className="shrink-0 w-20 h-20 md:w-28 md:h-28 bg-primary-black rounded-2xl overflow-hidden border border-white/5 flex items-center justify-center p-2 shadow-inner"
                      >
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-full h-full object-contain"
                        />
                      </Link>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <H3 className="text-base md:text-xl font-black text-primary-champagne uppercase tracking-tight leading-tight line-clamp-2">
                            {item.product.name}
                          </H3>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="shrink-0 text-primary-champagne/20 hover:text-red-500 transition-all p-1 -mt-0.5"
                            aria-label="Eliminar producto"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </div>
                        <span className="text-primary-gold font-black text-lg md:text-xl tracking-tight">
                          Q{item.product.price}
                        </span>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-0 border border-white/10 rounded-full overflow-hidden">
                            <button
                              onClick={() => decrementQuantity(item.product.id)}
                              className="w-9 h-9 flex items-center justify-center text-primary-champagne/60 hover:text-primary-gold hover:bg-white/5 transition-all text-lg font-black"
                              aria-label="Disminuir cantidad"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-black text-primary-champagne tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => incrementQuantity(item.product.id)}
                              className="w-9 h-9 flex items-center justify-center text-primary-champagne/60 hover:text-primary-gold hover:bg-white/5 transition-all text-lg font-black"
                              aria-label="Aumentar cantidad"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs text-primary-champagne/40 uppercase tracking-widest font-black">
                            Subtotal{" "}
                            <span className="text-primary-champagne/70">
                              Q{(item.product.price * item.quantity).toLocaleString()}
                            </span>
                          </span>
                        </div>
                        {itemHasStockIssue && (
                          <p className="mt-2 text-xs text-red-400 font-bold flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Sin stock suficiente. Solo quedan {item.product.stock} disponibles.
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <div className="lg:col-span-1 order-first lg:order-none">
              <div className="glass-card p-6 md:p-10 lg:sticky lg:top-32 border-primary-gold/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
                <H3 className="text-primary-gold mb-6 text-lg lg:text-md font-black uppercase tracking-[0.2em]">
                  Resumen
                </H3>
                <div className="flex flex-col gap-3 mb-6">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex justify-between items-center text-sm">
                      <span className="text-primary-champagne/50 truncate max-w-[60%]">
                        {item.product.name}
                        <span className="text-primary-champagne/30 ml-1">×{item.quantity}</span>
                      </span>
                      <span className="text-primary-champagne/70 font-black shrink-0">
                        Q{(item.product.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-white/5 mb-6" />
                {/* Total */}
                <div className="flex justify-between items-center mb-8">
                  <span className="text-primary-champagne/40 text-xs tracking-[0.3em] uppercase font-black">
                    Total
                  </span>
                  <span className="text-3xl md:text-4xl font-black text-primary-gold tracking-tighter">
                    Q{totalPrice.toLocaleString()}
                  </span>
                </div>
                {hasStockIssue && (
                  <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400 font-bold mb-1">
                      Sin stock suficiente
                    </p>
                    <p className="text-xs text-red-400/80">
                      Ajusta la cantidad de los productos marcados en rojo antes de continuar con la compra.
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleGoToPayment}
                  disabled={hasStockIssue}
                  className="w-full py-5 md:py-6 font-black uppercase tracking-[0.3em] text-sm shadow-[0_20px_60px_rgba(224,179,84,0.3)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {hasStockIssue ? "Ajusta tu carrito para continuar" : "Ir a Pagar"}
                </Button>
                <Link
                  to="/perfumes"
                  className="block text-center mt-4 text-xs text-primary-champagne/30 hover:text-primary-gold uppercase tracking-[0.2em] font-black transition-all"
                >
                  Seguir comprando
                </Link>
              </div>
            </div>
          </div>
        )}
      </Container>
    </MainLayout>
  );
}
