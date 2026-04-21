import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage";
import ProductPage from "../pages/ProductPage";
import PerfumesPage from "../pages/PerfumesPage";
import { ScrollToTop } from "./ScrollToTop";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/perfumes" element={<PerfumesPage />} />
        <Route path="/producto/:id" element={<ProductPage />} />
      </Routes>
    </BrowserRouter>
  );
}