import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import HomePage from "../pages/HomePage";
import ProductPage from "../pages/ProductPage";
import PerfumesPage from "../pages/PerfumesPage";
import NotFoundPage from "../pages/NotFoundPage";
import { ScrollToTop } from "./ScrollToTop";
import { CartProvider } from "../context/CartContext";
import { AuthProvider } from "../context/AuthContext";
import { SearchProvider } from "../context/SearchContext";
import { WishlistProvider } from "../context/WishlistContext";
import { ProtectedRoute } from "../components/routing/ProtectedRoute";
import { AdminRoute } from "../components/routing/AdminRoute";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

// SFTWRKEY-457: la portada, el catálogo y el detalle (por donde entran los clientes) van en el
// archivo principal. El resto de páginas se descarga solo cuando alguien entra a ellas, así el
// celular no tiene que bajar y ejecutar el código del panel de admin para ver la portada.
const CartPage = lazy(() => import("../pages/CartPage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const WishlistPage = lazy(() => import("../pages/WishlistPage"));
const ReportPage = lazy(() => import("../pages/ReportPage"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard"));
const AdminProductPage = lazy(() => import("../pages/AdminProductPage"));
const AdminCreateUserPage = lazy(() => import("../pages/AdminCreateUserPage"));
const AdminOrdersPage = lazy(() => import("../pages/AdminOrdersPage"));
const ImportPerfumesPage = lazy(() => import("../pages/ImportPerfumesPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage"));
const PaymentPage = lazy(() => import("../pages/Paymentpage"));
const GuestCheckoutPage = lazy(() =>
  import("../features/CommerceFeatures").then((m) => ({ default: m.GuestCheckoutPage }))
);
const UserPage = lazy(() => import("../pages/UserPage"));
const PrivacyPage = lazy(() => import("../pages/PrivacyPage"));
const TermsPage = lazy(() => import("../pages/TermsPage"));
const ShippingReturnsPage = lazy(() => import("../pages/ShippingReturnsPage"));
const FaqPage = lazy(() => import("../pages/FaqPage"));
const OrderConfirmationPage = lazy(() => import("../pages/OrderConfirmationPage"));

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* mientras se descarga una página se ve el mismo indicador de carga del sitio */}
      <Suspense fallback={<div className="min-h-screen bg-primary-black flex items-center justify-center"><LoadingSpinner /></div>}>
        {children}
      </Suspense>
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><HomePage /></PageWrapper>} />
        <Route path="/perfumes" element={<PageWrapper><PerfumesPage /></PageWrapper>} />
        <Route path="/producto/:id" element={<PageWrapper><ProductPage /></PageWrapper>} />
        <Route path="/cart" element={<PageWrapper><CartPage /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><LoginPage /></PageWrapper>} />
        {/* SFTWRKEY-428: recuperar contraseña */}
        <Route path="/recuperar-contrasena" element={<PageWrapper><ForgotPasswordPage /></PageWrapper>} />
        <Route path="/restablecer-contrasena" element={<PageWrapper><ResetPasswordPage /></PageWrapper>} />
        <Route path="/pago-invitado" element={<PageWrapper><GuestCheckoutPage /></PageWrapper>} />
        <Route path="/pago" element={<PageWrapper><PaymentPage /></PageWrapper>} />

        {/* SFTWRKEY-434: páginas legales */}
        <Route path="/privacidad" element={<PageWrapper><PrivacyPage /></PageWrapper>} />
        <Route path="/terminos" element={<PageWrapper><TermsPage /></PageWrapper>} />
        <Route path="/envios-devoluciones" element={<PageWrapper><ShippingReturnsPage /></PageWrapper>} />
        {/* SFTWRKEY-437 */}
        <Route path="/preguntas-frecuentes" element={<PageWrapper><FaqPage /></PageWrapper>} />

        {/* SFTWRKEY-422: solo ADMIN. Las rutas nuevas de admin (como /admin/pedidos) van aqui dentro */}
        <Route element={<AdminRoute />}>
          <Route path="/reporte" element={<PageWrapper><ReportPage /></PageWrapper>} />
          <Route path="/admin" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
          <Route path="/admin/nuevo" element={<PageWrapper><AdminProductPage /></PageWrapper>} />
          <Route path="/admin/editar/:id" element={<PageWrapper><AdminProductPage /></PageWrapper>} />
          <Route path="/admin/nuevo-usuario" element={<PageWrapper><AdminCreateUserPage /></PageWrapper>} />
          <Route path="/admin/importar" element={<PageWrapper><ImportPerfumesPage /></PageWrapper>} />
          <Route path="/admin/pedidos" element={<PageWrapper><AdminOrdersPage /></PageWrapper>} />
        </Route>

        <Route
          path="/compra-confirmada/:orderId"
          element={
            <PageWrapper>
              <OrderConfirmationPage />
            </PageWrapper>
          }
        />

        {/* SFTWRKEY-422: cualquier usuario con sesion */}
        <Route element={<ProtectedRoute />}>
          <Route path="/mi-cuenta" element={<PageWrapper><UserPage /></PageWrapper>} />
          {/* SFTWRKEY-429 */}
          <Route path="/lista-de-deseos" element={<PageWrapper><WishlistPage /></PageWrapper>} />
        </Route>

        {/* SFTWRKEY-423: cualquier URL desconocida. Tiene que ir al final */}
        <Route path="*" element={<PageWrapper><NotFoundPage /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <SearchProvider>
            <BrowserRouter>
              <ScrollToTop />
              <AnimatedRoutes />
            </BrowserRouter>
          </SearchProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}