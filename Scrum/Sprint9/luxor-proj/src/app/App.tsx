import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import HomePage from "../pages/HomePage";
import ProductPage from "../pages/ProductPage";
import PerfumesPage from "../pages/PerfumesPage";
import CartPage from "../pages/CartPage";
import LoginPage from "../pages/LoginPage";
import { ScrollToTop } from "./ScrollToTop";
import { CartProvider } from "../context/CartContext";
import { AuthProvider } from "../context/AuthContext";
import { SearchProvider } from "../context/SearchContext";
import { WishlistProvider } from "../context/WishlistContext";
import WishlistPage from "../pages/WishlistPage";
import ReportPage from "../pages/ReportPage";
import AdminDashboard from "../pages/AdminDashboard";
import AdminProductPage from "../pages/AdminProductPage";
import AdminCreateUserPage from "../pages/AdminCreateUserPage";
import AdminOrdersPage from "../pages/AdminOrdersPage";
import ImportPerfumesPage from "../pages/ImportPerfumesPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import PaymentPage from "../pages/Paymentpage";
import UserPage from "../pages/UserPage";
import PrivacyPage from "../pages/PrivacyPage";
import TermsPage from "../pages/TermsPage";
import ShippingReturnsPage from "../pages/ShippingReturnsPage";
import FaqPage from "../pages/FaqPage";
import { ProtectedRoute } from "../components/routing/ProtectedRoute";
import { AdminRoute } from "../components/routing/AdminRoute";

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
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

        {/* SFTWRKEY-422: cualquier usuario con sesion */}
        <Route element={<ProtectedRoute />}>
          <Route path="/mi-cuenta" element={<PageWrapper><UserPage /></PageWrapper>} />
          {/* SFTWRKEY-429 */}
          <Route path="/lista-de-deseos" element={<PageWrapper><WishlistPage /></PageWrapper>} />
        </Route>
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