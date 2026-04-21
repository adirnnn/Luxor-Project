import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage";
import ProductPage from "../pages/ProductPage";
import PerfumesPage from "../pages/PerfumesPage";
import CartPage from "../pages/CartPage";
import { ScrollToTop } from "./ScrollToTop";
import { CartProvider } from "../context/CartContext";

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/perfumes" element={<PerfumesPage />} />
          <Route path="/producto/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}
