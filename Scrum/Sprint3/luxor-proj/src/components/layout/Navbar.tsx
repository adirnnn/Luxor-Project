import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Container } from "../ui/Container";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useLocation } from "react-router-dom";

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
                className={`
                  relative text-sm transition-colors duration-200 py-1
                  after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:bg-primary-black
                  after:transition-all after:duration-300
                  ${isActive(link.href)
                    ? "text-primary-black font-medium after:w-full"
                    : "text-secondary-brown hover:text-primary-black after:w-0 hover:after:w-full"
                  }
                `}
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            )
          )}
          {isAuthenticated && user?.role === 'ADMIN' && (
            <>
              <Link
                to="/admin"
                className={`
                  relative text-sm transition-colors duration-200 py-1
                  after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:bg-primary-black
                  after:transition-all after:duration-300
                  ${isActive("/admin")
                    ? "text-primary-black font-medium after:w-full"
                    : "text-secondary-brown hover:text-primary-black after:w-0 hover:after:w-full"
                  }
                `}
              >
                Dashboard
              </Link>
              <Link
                to="/reporte"
                className={`
                  relative text-sm transition-colors duration-200 py-1
                  after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:bg-primary-black
                  after:transition-all after:duration-300
                  ${isActive("/reporte")
                    ? "text-primary-black font-medium after:w-full"
                    : "text-secondary-brown hover:text-primary-black after:w-0 hover:after:w-full"
                  }
                `}
              >
                Reporte
              </Link>
            </>
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
                <Link 
                to="/login"
                className="text-xs font-semibold bg-primary-gold text-primary-black hover:opacity-85 active:scale-[0.97] transition-all duration-150 px-4 py-2.5 rounded-lg tracking-wide"
                >
                    Ingresar
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

      {/* Menu de movil */}
      {open && (
        <div className="md:hidden border-t border-primary-beige bg-primary-champagne">
          <Container className="py-4 flex flex-col gap-4">
            {navLinks.map((link) =>
              link.href.includes("#") ? (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`
                    flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200
                    text-secondary-brown hover:text-primary-black hover:bg-primary-beige/40
                  `}
                >
                  {link.label}
                </a>

              ) : (

                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className={`
                    flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive(link.href)
                      ? "bg-primary-black text-white shadow-sm"
                      : "text-secondary-brown hover:text-primary-black hover:bg-primary-beige/40"
                    }
                  `}
                  aria-current={isActive(link.href) ? "page" : undefined}
                >
                  {link.label}

                  {isActive(link.href) && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
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
                <Link to="/login" onClick={() => setOpen(false)}
                className="mx-1 py-3.5 text-center text-sm font-semibold bg-primary-gold text-primary-black rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-150 tracking-wide"
                >
                    Ingresar
                  
                </Link>
              </>
            )}
          </Container>
        </div>
      )}
    </header>
  );
};
