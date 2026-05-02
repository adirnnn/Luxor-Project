import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

type Props = {
  children: ReactNode;
};

export const MainLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen flex flex-col bg-primary-champagne">
      <Navbar />

      <main className="flex-1 pb-16">{children}</main>

      <footer 
      id = "contacto"
      className="border-t border-primary-beige bg-primary-champagne px-6 py-10 text-secondary-brown">
  <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3 text-sm">
    
    {/* Marca */}
    <div>
      <h3 className="text-lg font-semibold mb-2">Joyero Árabe</h3>
      <p>Perfumes árabes auténticos con esencia única.</p>
    </div>

    {/* Ubicaciones */}
    <div>
      <h3 className="text-lg font-semibold mb-2">Nuestras tiendas</h3>
      <ul className="space-y-1">
        <li>📍 Luxor
          <div className="text-xs text-gray-500">
            18 Calle 26-12 Zona 16 Centro Comercial Centro San Isidro Kiosco 4B, Guatemala City
          </div>
        </li>
        <li>📍 Glamour
          <div className="text-xs text-gray-500">
            x Avenida xx-xx Zona x, Guatemala City
          </div>
        </li>
        <li>📍 Victoria
          <div className="text-xs text-gray-500">
            x Avenida xx-xx Zona x, Guatemala City
          </div>
        </li>
      </ul>
    </div>

    {/* Contacto / redes */}
    <div>
      <h3 className="text-lg font-semibold mb-2">Contáctanos</h3>
      <ul className="space-y-1">
        <li>
          Instagram:{" "}
          <a href="https://www.instagram.com/eljoyeroarabe/" target="_blank" className="underline">
            @eljoyeroarabe
          </a>
        </li>
        <li>WhatsApp: +502 XXXX-XXXX</li>
      </ul>
    </div>
  </div>

  {/* Línea inferior */}
  <div className="mt-8 border-t border-primary-beige pt-4 text-center text-xs">
    © {new Date().getFullYear()} Joyero Árabe. Todos los derechos reservados.
  </div>
</footer>
    </div>
  );
};