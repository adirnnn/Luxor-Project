import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { H3, PageTitle, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useCart } from "../context/CartContext";
import { maxQuantityFor } from "../context/cartLimits";
import { QuantitySelector } from "../components/ui/QuantitySelector";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageMeta } from "../components/seo/PageMeta";
import { formatPrice } from "../utils/formatPrice";
import { freeShippingHint, shippingFor, shippingLabel, useShippingOptions } from "../utils/shipping";
import { useCoupon } from "../features/coupons/useCoupon";
import { CouponField } from "../features/coupons/CouponField";
import { wholesaleDiscount, wholesaleLabel } from "../utils/wholesale";

export default function CartPage() {
  const { cart, totalPrice, setQuantity, removeFromCart } = useCart();
  // SFTWRKEY-449: el carrito muestra el envío a domicilio; al pagar se puede elegir recoger en tienda
  const shippingOptions = useShippingOptions();
  // SFTWRKEY-432: el cupón se aplica aquí y sigue al pagar; el envío se calcula con los productos ya rebajados
  const coupon = useCoupon(
    cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
    totalPrice,
  );
  const { user } = useAuth();
  // feedback del cliente: el mayorista ve su precio y no usa cupones (no se combinan)
  const wholesalePercent = user?.wholesalePercent;
  const discount = wholesalePercent ? wholesaleDiscount(totalPrice, wholesalePercent) : coupon.discount;
  const shipping = shippingFor(totalPrice - discount, "envio", shippingOptions);
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
      <PageMeta title="Carrito" noindex />
      <Container className="pb-24 md:pb-32 px-4 md:px-6">
        <PageTitle className="mb-8 md:mb-16">
          Tu Selección
        </PageTitle>
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
                        ? "glass-card p-4 md:p-6 border border-status-error/30 bg-status-error-bg"
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
                          loading="lazy"
                          decoding="async"
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
                            className="shrink-0 text-primary-champagne/20 hover:text-status-error transition-all p-1 -mt-0.5"
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
                          {formatPrice(item.product.price)}
                        </span>
                        <div className="flex items-center justify-between mt-3">
                          <QuantitySelector
                            size="sm"
                            value={item.quantity}
                            max={Math.max(maxQuantityFor(item.product), item.quantity)}
                            onChange={(n) => setQuantity(item.product.id, n)}
                          />
                          <span className="text-xs text-primary-champagne/40 uppercase tracking-widest font-black">
                            Subtotal{" "}
                            <span className="text-primary-champagne/70">
                              {formatPrice(item.product.price * item.quantity)}
                            </span>
                          </span>
                        </div>
                        {itemHasStockIssue && (
                          <p className="mt-2 text-xs text-status-error font-bold flex items-center gap-1.5">
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
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-white/5 mb-6" />
                {!wholesalePercent && (
                <div className="mb-6">
                  <CouponField
                    coupon={coupon.coupon}
                    belowMinimum={coupon.belowMinimum}
                    error={coupon.error}
                    checking={coupon.checking}
                    onApply={coupon.apply}
                    onRemove={coupon.remove}
                  />
                </div>
                )}
                {/* SFTWRKEY-449: envío a domicilio (Q35, gratis desde Q500) o gratis al recoger en tienda */}
                <div className="flex flex-col gap-2 mb-6 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-primary-champagne/40">Subtotal</span>
                    <span className="text-primary-champagne/70 font-bold">{formatPrice(totalPrice)}</span>
                  </div>
                  {wholesalePercent && discount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-primary-champagne/40">{wholesaleLabel(wholesalePercent)}</span>
                      <span className="text-status-success font-bold">−{formatPrice(discount)}</span>
                    </div>
                  )}
                  {!wholesalePercent && coupon.discount > 0 && coupon.coupon && (
                    <div className="flex justify-between items-center">
                      <span className="text-primary-champagne/40">Descuento ({coupon.coupon.code})</span>
                      <span className="text-status-success font-bold">−{formatPrice(coupon.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-primary-champagne/40">Envío a domicilio</span>
                    <span className="text-primary-champagne/70 font-bold">{shippingLabel(shipping)}</span>
                  </div>
                  <p className="text-xs text-primary-champagne/30">
                    {shipping > 0 ? `${freeShippingHint(shippingOptions)}. ` : ""}Recoger en tienda es gratis.
                  </p>
                </div>
                {/* Total */}
                <div className="flex justify-between items-center mb-8">
                  <span className="text-primary-champagne/40 text-xs tracking-[0.3em] uppercase font-black">
                    Total
                  </span>
                  <span className="text-3xl md:text-4xl font-black text-primary-gold tracking-tighter">
                    {formatPrice(totalPrice - discount + shipping)}
                  </span>
                </div>
                {hasStockIssue && (
                  <div className="mb-4 p-4 rounded-2xl bg-status-error-bg border border-status-error/30">
                    <p className="text-sm text-status-error font-bold mb-1">
                      Sin stock suficiente
                    </p>
                    <p className="text-xs text-status-error/80">
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
                {!user && !hasStockIssue && (
                  <Link
                    to="/pago-invitado"
                    className="block text-center mt-4 text-xs text-primary-gold hover:text-primary-champagne uppercase tracking-[0.2em] font-black transition-all"
                  >
                    Comprar como invitado
                  </Link>
                )}
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