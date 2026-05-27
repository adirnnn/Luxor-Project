import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Container } from "../ui/Container";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Perfumes", href: "/perfumes" },
  { label: "Nosotros", href: "/#brand" },
  { label: "Contacto", href: "#contacto" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { totalItems } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path.includes("#")) return false;
    return location.pathname.startsWith(path);
  };

  return (
    <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-6xl bg-primary-black/60 backdrop-blur-xl border border-white/[0.08] rounded-full shadow-2xl"
      >
        <Container className="flex items-center justify-between h-16 md:h-20 px-8">

          <Link to="/" className="flex items-center hover:scale-105 transition-all duration-700 py-1">
            <span className="text-primary-gold font-brand text-4xl md:text-5xl font-normal lowercase tracking-tight">Habibi</span>
          </Link>

          <nav className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`
                  relative text-xl tracking-[0.05em] lowercase transition-all duration-300 py-2 font-brand
                  ${isActive(link.href) ? "text-primary-gold" : "text-primary-champagne/80 hover:text-primary-gold hover:scale-110"}
                `}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated && user?.role === 'ADMIN' && (
              <>
                <Link to="/admin" className="text-xl tracking-[0.05em] lowercase text-primary-champagne/80 hover:text-primary-gold font-brand transition-all">Panel</Link>
                <Link to="/reporte" className="text-xl tracking-[0.05em] lowercase text-primary-champagne/80 hover:text-primary-gold font-brand transition-all">Reporte</Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-8">
            <Link to="/cart" className="relative text-primary-champagne/80 hover:text-primary-gold transition-all hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                <path d="M3 6h18"></path>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-3 -right-3 bg-primary-gold text-primary-black text-[11px] font-black min-w-[22px] h-[22px] flex items-center justify-center rounded-full shadow-2xl">
                  {totalItems}
                </span>
              )}
            </Link>

            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated && user ? (
                <button
                  onClick={handleLogout}
                  className="text-xs tracking-[0.2em] uppercase text-primary-champagne/60 hover:text-primary-gold font-bold transition-all"
                >
                  Salir
                </button>
              ) : (
                <Link 
                  to="/login"
                  className="text-xs uppercase tracking-[0.2em] font-black bg-primary-gold text-primary-black px-8 py-3 rounded-button hover:bg-primary-champagne hover:scale-110 transition-all shadow-lg"
                >
                  Entrar
                </Link>
              )}
            </div>
            
            <button
              className="md:hidden text-primary-champagne flex items-center justify-center"
              onClick={() => setOpen(!open)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12"></line>
                <line x1="4" x2="20" y1="6" y2="6"></line>
                <line x1="4" x2="20" y1="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </Container>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="md:hidden absolute top-24 left-4 right-4 bg-primary-black/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-6 items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className="text-xs tracking-[0.2em] uppercase text-primary-gold font-black"
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && user ? (
                <button
                  onClick={handleLogout}
                  className="text-xs tracking-[0.2em] uppercase text-primary-gold font-black"
                >
                  Cerrar sesión
                </button>
              ) : (
                <Link 
                  to="/login" 
                  onClick={() => setOpen(false)} 
                  className="text-xs tracking-[0.2em] uppercase text-primary-black font-black bg-primary-gold px-12 py-4 rounded-button hover:bg-primary-champagne w-full text-center"
                >
                  Entrar
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};