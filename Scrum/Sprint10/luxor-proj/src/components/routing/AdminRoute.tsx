import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIsPresent } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

// SFTWRKEY-422: rutas solo para ADMIN. Sin sesion va al login; con sesion pero
// sin rol de admin, al inicio.
export function AdminRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const isPresent = useIsPresent();
  // SFTWRKEY-457: si al abrir la pagina no era admin, en la salida no se dibuja la pagina
  // (las paginas se cargan por partes y una que nunca se mostro se quedaba trabada al salir)
  const [eraAdmin] = useState(() => isAuthenticated && user?.role === "ADMIN");

  // igual que en ProtectedRoute: no redirigir durante la animacion de salida
  if (!isPresent) return eraAdmin ? <Outlet /> : null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
