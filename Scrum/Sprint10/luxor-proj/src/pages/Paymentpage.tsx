import { useRef, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { H3, PageTitle } from "../components/ui/Typography";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { PaymentForm } from "../validation/PaymentForm";
import type { PaymentFormState } from "../validation/usePaymentForm";
import { processCheckout, type CheckoutError } from "../services/checkoutService";
import { PageMeta } from "../components/seo/PageMeta";
import { formatPrice } from "../utils/formatPrice";
import { trackPurchase } from "../utils/analytics";

export default function PaymentPage() {
    const { cart, totalPrice, clearCart } = useCart();
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [isProcessing, setIsProcessing] = useState(false);
    const [checkoutError, setCheckoutError] =
        useState<CheckoutError | null>(null);

    const [completed, setCompleted] = useState(false);
    const sending = useRef(false);

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    if (cart.length === 0 && !completed) {
        return <Navigate to="/cart" replace />;
    }

    const outOfStockItems = cart.filter(
        (item) =>
        item.product.stock !== undefined &&
        item.quantity > item.product.stock
    );

    if (outOfStockItems.length > 0 && !completed) {
    return <Navigate to="/cart" replace />;
}

    const handlePaymentSubmit = async (values: PaymentFormState) => {
    if (sending.current) return;

    sending.current = true;
    setCheckoutError(null);
    setIsProcessing(true);

    try {
        const result = await processCheckout(Number(user.id), values);

        trackPurchase(
            Number(result.order.total),
            cart.reduce((total, item) => total + item.quantity, 0)
        );

        setCompleted(true);
        clearCart();

        navigate(`/compra-confirmada/${result.order.id}`, {
            replace: true,
        });
    } catch (err) {
        setCheckoutError(err as CheckoutError);
    } finally {
        sending.current = false;
        setIsProcessing(false);
        }
    };

  // Evita volver al carrito durante la animación de salida.
    if (completed) {
        return (
        <MainLayout>
            <PageMeta title="Compra registrada" noindex />

            <Container>
            <p
                role="status"
                className="text-primary-champagne"
            >
                Compra registrada. Abriendo tu pedido…
            </p>

            <Link
                className="text-primary-gold underline"
                to="/mi-cuenta"
            >
                Ver mis compras
            </Link>
            </Container>
        </MainLayout>
        );
    }

// Pagina de pago 
    return (
        <MainLayout>
        <PageMeta title="Pago" noindex />
        <Container className="pb-24 md:pb-32 px-4 md:px-6">
            <button
            onClick={() => navigate("/cart")}
            className="mb-6 flex items-center gap-2 text-xs text-primary-champagne/40 hover:text-primary-gold uppercase tracking-[0.2em] font-black transition-all"
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver al carrito
            </button>

            <PageTitle className="mb-8 md:mb-16">
            Pago Seguro
            </PageTitle>

            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-12">
            {/* Formulario de pago */}
            <div className="lg:col-span-2">
                <div className="glass-card p-6 md:p-10 border-none">
                <H3 className="text-primary-gold mb-8 text-lg lg:text-md font-black uppercase tracking-[0.2em]">
                    Datos de pago
                </H3>

                {checkoutError && (
                    <div className="mb-6 p-4 rounded-2xl bg-status-error-bg border border-status-error/30">
                    <p className="text-sm text-status-error font-bold mb-1">
                        {checkoutError.code === "INSUFFICIENT_STOCK"
                          ? "Sin stock suficiente"
                          : checkoutError.code === "CARD_DECLINED"
                          ? "Tarjeta rechazada"
                          : "No se pudo procesar tu compra"}
                    </p>
                    <p className="text-xs text-status-error/80">{checkoutError.message}</p>
                    {checkoutError.items && (
                        <ul className="mt-2 text-xs text-status-error/70 list-disc list-inside">
                        {checkoutError.items.map((i) => (
                            <li key={i.product_id}>{i.name}: pediste {i.solicitado}, quedan {i.disponible}</li>
                        ))}
                        </ul>
                    )}
                    </div>
                )}

                <PaymentForm isProcessing={isProcessing} onValidSubmit={handlePaymentSubmit} />
                </div>
            </div>

            {/* Resumen de compra */}
            <div className="lg:col-span-1 order-first lg:order-none">
                <div className="glass-card p-6 md:p-10 lg:sticky lg:top-32 border-primary-gold/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
                <H3 className="text-primary-gold mb-6 text-lg lg:text-md font-black uppercase tracking-[0.2em]">
                    Resumen de compra
                </H3>

                <div className="flex flex-col gap-4 mb-6 max-h-72 overflow-y-auto pr-1">
                    {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-3">
                        <div className="shrink-0 w-14 h-14 bg-primary-black rounded-xl overflow-hidden border border-white/5 flex items-center justify-center p-1.5">
                        <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="w-full h-full object-contain"
                        />
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="text-sm text-primary-champagne/80 font-bold truncate">
                            {item.product.name}
                        </p>
                        <p className="text-xs text-primary-champagne/40">
                            Cantidad: {item.quantity}
                        </p>
                        </div>
                        <span className="text-sm text-primary-champagne/70 font-black shrink-0">
                        {formatPrice(item.product.price * item.quantity)}
                        </span>
                    </div>
                    ))}
                </div>

                <div className="h-px bg-white/5 mb-6" />

                <div className="flex flex-col gap-3 mb-6 text-sm">
                    <div className="flex justify-between items-center">
                    <span className="text-primary-champagne/40">Subtotal</span>
                    <span className="text-primary-champagne/70 font-bold">{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                    <span className="text-primary-champagne/40">Envío</span>
                    <span className="text-primary-champagne/70 font-bold">Gratis</span>
                    </div>
                </div>

                <div className="h-px bg-white/5 mb-6" />

                <div className="flex justify-between items-center">
                    <span className="text-primary-champagne/40 text-xs tracking-[0.3em] uppercase font-black">
                    Total
                    </span>
                    <span className="text-3xl md:text-4xl font-black text-primary-gold tracking-tighter">
                    {formatPrice(totalPrice)}
                    </span>
                </div>
                </div>
            </div>
            </div>
        </Container>
        </MainLayout>
    );
}