import { useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { H1, H3, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { PaymentForm } from "../validation/PaymentForm";
import type { PaymentFormState } from "../validation/usePaymentForm";
import { processCheckout, type CheckoutError } from "../services/checkoutService";

export default function PaymentPage() {
    const { cart, totalPrice, clearCart } = useCart();
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [isProcessing, setIsProcessing] = useState(false);
    const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);
    const [confirmedOrder, setConfirmedOrder] = useState<{
        id: number;
        total: number;
        created_at: string;
    } | null>(null);

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" replace />;
    }

    if (cart.length === 0 && !confirmedOrder) {
        return <Navigate to="/cart" replace />;
    }

    const outOfStockItems = cart.filter(
    (item) => item.product.stock !== undefined && item.quantity > item.product.stock
    );
    if (outOfStockItems.length > 0 && !confirmedOrder) {
        return <Navigate to="/cart" replace />;
    }

    const handlePaymentSubmit = async (_values: PaymentFormState) => {
        setCheckoutError(null);
        setIsProcessing(true);
        try {
        const result = await processCheckout(Number(user.id));
        clearCart();
        setConfirmedOrder(result.order);
        } catch (err) {
        setCheckoutError(err as CheckoutError);
        } finally {
        setIsProcessing(false);
        }
    };

//Pantalla de confirmación 
    if (confirmedOrder) {
        return (
        <MainLayout>
            <Container className="py-24 md:py-32 px-4 md:px-6">
            <AnimatePresence>
                <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-xl mx-auto text-center glass-card p-10 md:p-16 border-primary-gold/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]"
                >
                <div className="mx-auto mb-8 w-20 h-20 rounded-full bg-primary-gold/10 border border-primary-gold/30 flex items-center justify-center">
                    <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary-gold"
                    >
                    <path d="M20 6L9 17l-5-5" />
                    </svg>
                </div>

                <H1 className="mb-4 text-3xl md:text-5xl font-heading font-black italic text-primary-gold uppercase tracking-tighter">
                    Pago Exitoso
                </H1>

                <Text className="mb-10 text-primary-champagne/60 text-base md:text-lg not-italic">
                    Gracias, {user.name}. Tu pedido fue registrado con éxito.
                </Text>

                <div className="flex flex-col gap-3 mb-10 text-sm">
                    <div className="flex justify-between items-center px-2">
                    <span className="text-primary-champagne/40 uppercase tracking-widest text-xs font-black">
                        Número de pedido
                    </span>
                    <span className="text-primary-champagne font-black">#{confirmedOrder.id}</span>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="flex justify-between items-center px-2">
                    <span className="text-primary-champagne/40 uppercase tracking-widest text-xs font-black">
                        Total pagado
                    </span>
                    <span className="text-2xl font-black text-primary-gold tracking-tighter">
                        Q{confirmedOrder.total.toLocaleString()}
                    </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link to="/user">
                    <Button className="w-full sm:w-auto px-10 py-4 font-black uppercase tracking-[0.3em] text-sm shadow-2xl">
                        Ver mis compras
                    </Button>
                    </Link>
                    <Link to="/perfumes">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto px-10 py-4 font-black uppercase tracking-[0.3em] text-sm"
                    >
                        Seguir comprando
                    </Button>
                    </Link>
                </div>
                </motion.div>
            </AnimatePresence>
            </Container>
        </MainLayout>
        );
    }

// Pagina de pago 
    return (
        <MainLayout>
        <Container className="py-24 md:py-32 px-4 md:px-6">
            <button
            onClick={() => navigate("/cart")}
            className="mb-6 flex items-center gap-2 text-xs text-primary-champagne/40 hover:text-primary-gold uppercase tracking-[0.2em] font-black transition-all"
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver al carrito
            </button>

            <H1 className="mb-8 md:mb-16 text-4xl md:text-7xl font-heading font-black italic text-primary-gold uppercase tracking-tighter">
            Pago Seguro
            </H1>

            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-12">
            {/* Formulario de pago */}
            <div className="lg:col-span-2">
                <div className="glass-card p-6 md:p-10 border-none">
                <H3 className="text-primary-gold mb-8 text-lg lg:text-md font-black uppercase tracking-[0.2em]">
                    Datos de pago
                </H3>

                {checkoutError && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400 font-bold mb-1">
                        {checkoutError.code === "INSUFFICIENT_STOCK" ? "Sin stock suficiente" : "No se pudo procesar tu compra"}
                    </p>
                    <p className="text-xs text-red-400/80">{checkoutError.message}</p>
                    {checkoutError.items && (
                        <ul className="mt-2 text-xs text-red-400/70 list-disc list-inside">
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
                        Q{(item.product.price * item.quantity).toLocaleString()}
                        </span>
                    </div>
                    ))}
                </div>

                <div className="h-px bg-white/5 mb-6" />

                <div className="flex flex-col gap-3 mb-6 text-sm">
                    <div className="flex justify-between items-center">
                    <span className="text-primary-champagne/40">Subtotal</span>
                    <span className="text-primary-champagne/70 font-bold">Q{totalPrice.toLocaleString()}</span>
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
                    Q{totalPrice.toLocaleString()}
                    </span>
                </div>
                </div>
            </div>
            </div>
        </Container>
        </MainLayout>
    );
}