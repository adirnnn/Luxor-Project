import { useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Perfumes", href: "/perfumes" },
  { label: "Nosotros", href: "#brand" },
  { label: "Contacto", href: "#" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-primary-champagne/80 backdrop-blur-md border-b border-primary-beige">
      <Container className="flex items-center justify-between h-20">

        {/* Logo */}
        <Link to="/" className="font-heading text-lg tracking-wide">
          Joyero Árabe
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) =>
            link.href.startsWith("#") ? (
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

        {/* CTA */}
        <div className="hidden md:block">
          <Link to="#perfumes">
            <Button>Explorar</Button>
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-primary-black"
          onClick={() => setOpen(!open)}
        >
          ☰
        </button>
      </Container>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden border-t border-primary-beige">
          <Container className="py-4 flex flex-col gap-4">
            {navLinks.map((link) =>
              link.href.startsWith("#") ? (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.href}>
                  {link.label}
                </Link>
              )
            )}
            <Link to="/">
              <Button className="w-full">Explorar</Button>
            </Link>
          </Container>
        </div>
      )}
    </header>
  );
};