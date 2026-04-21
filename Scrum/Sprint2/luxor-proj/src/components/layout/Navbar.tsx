import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";

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

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-primary-champagne/80 backdrop-blur-md border-b border-primary-beige">
      <Container className="flex items-center justify-between h-20">

        <Link to="/" className="font-heading text-lg tracking-wide">
          Joyero Árabe
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) =>
            link.href.includes("#") ? (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-secondary-brown hover:text-primary-black"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm text-secondary-brown hover:text-primary-black"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-4">

          <Link to="/cart" className="relative p-2 text-secondary-brown hover:text-primary-black transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 bg-primary-gold text-primary-black text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full border border-primary-champagne">
                {totalItems}
              </span>
            )}
          </Link>
<div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-secondary-brown hover:text-primary-black transition-colors px-3 py-2 rounded-xl border border-primary-beige hover:border-secondary-brown/40"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="primary" className="py-2 px-5 text-xs">
                    Ingresar
                  </Button>
                </Link>
              </>
            )}
          </div>
          <button
            className="md:hidden text-primary-black text-2xl w-10 h-10 flex items-center justify-center"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menú"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </Container>

      {open && (
        <div className="md:hidden border-t border-primary-beige bg-primary-champagne">
          <Container className="py-4 flex flex-col gap-4">
            {navLinks.map((link) =>
              link.href.includes("#") ? (
                <a key={link.label} href={link.href} className="text-sm text-secondary-brown" onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.href} className="text-sm text-secondary-brown" onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              )
            )}

            {isAuthenticated && user ? (
              <>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm text-secondary-brown hover:text-primary-black transition-colors"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)}>
                  <Button variant="secondary" className="w-full">
                    Ingresar
                  </Button>
                </Link>
              </>
            )}
          </Container>
        </div>
      )}
    </header>
  );
};
