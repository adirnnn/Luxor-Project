import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIsPresent } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

// SFTWRKEY-422: solo deja pasar si hay sesion. Si no, manda al login y guarda
// de donde venia para regresarlo ahi despues de entrar.
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isPresent = useIsPresent();

  // al cerrar sesion la pagina vieja sigue un momento en la animacion de salida;
  // ahi no hay que redirigir, si no manda al login en vez de a donde iba
  if (!isPresent) return <Outlet />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
