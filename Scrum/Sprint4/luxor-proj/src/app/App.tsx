import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/perfumes" element={<PerfumesPage />} />
            <Route path="/producto/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reporte" element={<ReportPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/nuevo" element={<AdminProductPage />} />
            <Route path="/admin/editar/:id" element={<AdminProductPage />} />
            {/* SFTWRKEY-220: Ruta para crear usuario */}
            <Route path="/admin/nuevo-usuario" element={<AdminCreateUserPage />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
