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
import ReportPage from "../pages/ReportPage";
import AdminDashboard from "../pages/AdminDashboard";
import AdminProductPage from "../pages/AdminProductPage";
import AdminCreateUserPage from "../pages/AdminCreateUserPage";

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
        <Route path="/reporte" element={<PageWrapper><ReportPage /></PageWrapper>} />
        <Route path="/admin" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
        <Route path="/admin/nuevo" element={<PageWrapper><AdminProductPage /></PageWrapper>} />
        <Route path="/admin/editar/:id" element={<PageWrapper><AdminProductPage /></PageWrapper>} />
        <Route path="/admin/nuevo-usuario" element={<PageWrapper><AdminCreateUserPage /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AnimatedRoutes />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
