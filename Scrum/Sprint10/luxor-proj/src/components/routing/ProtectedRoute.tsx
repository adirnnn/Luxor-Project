import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIsPresent } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

// SFTWRKEY-422: solo deja pasar si hay sesion. Si no, manda al login y guarda
// de donde venia para regresarlo ahi despues de entrar.
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isPresent = useIsPresent();
  // SFTWRKEY-457: si al abrir la pagina no habia sesion, en la salida no se dibuja la pagina
  // (las paginas se cargan por partes y una que nunca se mostro se quedaba trabada al salir)
  const [teniaSesion] = useState(isAuthenticated);

  // al cerrar sesion la pagina vieja sigue un momento en la animacion de salida;
  // ahi no hay que redirigir, si no manda al login en vez de a donde iba
  if (!isPresent) return teniaSesion ? <Outlet /> : null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
