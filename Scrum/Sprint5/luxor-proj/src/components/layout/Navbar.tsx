import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Container } from "../ui/Container";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useSearch } from "../../context/SearchContext";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Perfumes", href: "/perfumes" },
  { label: "Nosotros", href: "/#brand" },
  { label: "Contacto", href: "#contacto" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const { totalItems } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const { query, results, setQuery, clearSearch } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path.includes("#")) return false;
    if (path === "/reporte") return location.pathname === "/reporte";
    return location.pathname.startsWith(path);
  };

  const openSearch = () => {
    setSearchActive(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchActive(false);
    setQuery("");
  };

  const handleResultClick = (id: string) => {
    closeSearch();
    navigate(`/producto/${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") closeSearch();
    if (e.key === "Enter" && query.trim()) {
      closeSearch();
      navigate(`/perfumes?q=${encodeURIComponent(query.trim())}`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchActive(false);
        setQuery("");
      }
    };
    if (searchActive) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchActive]);

  return (
    <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
      <motion.div
        ref={searchRef}
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-6xl bg-primary-black/60 backdrop-blur-xl border border-white/[0.08] rounded-full shadow-2xl"
      >
        <Container className="flex items-center justify-between h-16 md:h-20 px-8">

          <Link to="/" className="flex items-center hover:scale-105 transition-all duration-700 py-1 shrink-0">
            <span className="text-primary-gold font-brand text-4xl md:text-5xl font-normal lowercase tracking-tight">Habibi</span>
          </Link>

          <AnimatePresence>
            {!searchActive && (
              <motion.nav
                key="nav-links"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="hidden md:flex items-center gap-12"
              >
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
                {isAuthenticated && user?.role === "ADMIN" && (
                  <>
                    <Link to="/admin" className="text-xl tracking-[0.05em] lowercase text-primary-champagne/80 hover:text-primary-gold font-brand transition-all">Panel</Link>
                    <Link to="/reporte" className="text-xl tracking-[0.05em] lowercase text-primary-champagne/80 hover:text-primary-gold font-brand transition-all">Reporte</Link>
                  </>
                )}
              </motion.nav>
            )}
          </AnimatePresence>

          {/* Buscador expandible */}
          <AnimatePresence>
            {searchActive && (
              <motion.div
                key="search-bar"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "100%" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="hidden md:flex flex-1 mx-8 relative"
              >
                <div className="relative w-full">
                  <div className="flex items-center gap-3 w-full px-6 py-3 rounded-full bg-white/[0.06] border border-white/[0.12] focus-within:border-primary-gold/40 transition-all duration-300">
                    <svg
                      className="text-primary-gold shrink-0"
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Buscar fragancia..."
                      className="flex-1 bg-transparent text-primary-champagne placeholder:text-primary-champagne/30 text-sm tracking-wide focus:outline-none"
                    />
                    {query && (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                        className="text-primary-champagne/40 hover:text-primary-gold transition-all"
                        aria-label="Limpiar búsqueda"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {query.trim().length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 mt-3 bg-primary-black/95 backdrop-blur-2xl border border-white/[0.08] rounded-[24px] overflow-hidden shadow-2xl"
                      >
                        {results.length > 0 ? (
                          <ul className="py-2 max-h-72 overflow-y-auto">
                            {results.map((product) => (
                              <li key={product.id}>
                                <button
                                  onClick={() => handleResultClick(product.id)}
                                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/[0.04] transition-all duration-200 text-left group"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-primary-black/60 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                                    <img
                                      src={product.image}
                                      alt={product.name}
                                      className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-500"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary-champagne truncate">{product.name}</p>
                                    <p className="text-xs text-primary-champagne/40 truncate italic">{product.notes.salida} · {product.notes.corazon}</p>
                                  </div>
                                  <span className="text-sm font-light text-primary-gold shrink-0">Q{product.price}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="py-8 text-center">
                            <p className="text-xs text-primary-champagne/30 uppercase tracking-[0.2em] font-medium">Sin resultados para</p>
                            <p className="text-sm text-primary-champagne/60 italic mt-1">"{query}"</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-6">
            {/* Botón de búsqueda */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={searchActive ? closeSearch : openSearch}
              className="hidden md:flex text-primary-champagne/80 hover:text-primary-gold transition-all hover:scale-110"
              aria-label="Buscar"
            >
              <AnimatePresence mode="wait">
                {searchActive ? (
                  <motion.svg
                    key="close-icon"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </motion.svg>
                ) : (
                  <motion.svg
                    key="search-icon"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </button>

            {/* Carrito */}
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

      {/* Menú móvil */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="md:hidden absolute top-24 left-4 right-4 bg-primary-black/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-4 items-center">
              <div className="w-full flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.06] border border-white/[0.10]">
                <svg className="text-primary-gold shrink-0" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && query.trim()) {
                      setOpen(false);
                      clearSearch();
                      navigate(`/perfumes?q=${encodeURIComponent(query.trim())}`);
                    }
                  }}
                  placeholder="Buscar fragancia..."
                  className="flex-1 bg-transparent text-primary-champagne placeholder:text-primary-champagne/30 text-sm focus:outline-none"
                />
              </div>

              {/* Resultados móvil */}
              {query.trim().length > 0 && results.length > 0 && (
                <div className="w-full">
                  {results.slice(0, 4).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setOpen(false);
                        handleResultClick(product.id);
                      }}
                      className="w-full flex items-center gap-3 py-2.5 px-2 hover:bg-white/[0.04] rounded-xl transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary-black border border-white/5 overflow-hidden shrink-0 p-1">
                        <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                      </div>
                      <span className="text-sm text-primary-champagne/80 truncate flex-1">{product.name}</span>
                      <span className="text-xs text-primary-gold shrink-0">Q{product.price}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="w-full h-px bg-white/5" />

              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className={`text-xs tracking-[0.2em] uppercase font-black transition-all ${
                    isActive(link.href)
                      ? "text-primary-champagne"
                      : "text-primary-gold"
                  }`}
                >
                  {isActive(link.href) && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-champagne mr-2 mb-0.5" />
                  )}
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && user?.role === "ADMIN" && (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className={`text-xs tracking-[0.2em] uppercase font-black transition-all ${
                      isActive("/admin")
                        ? "text-primary-champagne"
                        : "text-primary-gold"
                    }`}
                  >
                    {isActive("/admin") && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-champagne mr-2 mb-0.5" />
                    )}
                    Panel
                  </Link>
                  <Link
                    to="/reporte"
                    onClick={() => setOpen(false)}
                    className={`text-xs tracking-[0.2em] uppercase font-black transition-all ${
                      isActive("/reporte")
                        ? "text-primary-champagne"
                        : "text-primary-gold"
                    }`}
                  >
                    {isActive("/reporte") && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-champagne mr-2 mb-0.5" />
                    )}
                    Reporte
                  </Link>
                </>
              )}
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