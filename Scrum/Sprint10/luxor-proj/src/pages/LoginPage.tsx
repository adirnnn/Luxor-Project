import {
    Link,
    Navigate,
    useLocation,
    useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { LoginForm } from "../validation/LoginForm";

import type { AuthUser } from "../validation/authService";

import { GoogleAccess } from "../features/CommerceFeatures";
import { AuthDivider, AuthShell } from "../components/auth/AuthShell";
import { SESSION_EXPIRED_MESSAGE } from "../components/auth/sessionMessages";

export default function LoginPage() {
    const { login, isAuthenticated, sessionExpired } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // SFTWRKEY-422: si llego desde una ruta protegida, despues de entrar vuelve ahi
    const fromState = (location.state as { from?: { pathname?: string } } | null)?.from;
    const from = fromState?.pathname || "/";

    // Si ya está autenticado (tambien despues de entrar con Google), redirigir
    if (isAuthenticated) {
        return <Navigate to={from} replace />;
    }

    const handleSuccess = (user: AuthUser) => {
        login(user);
        navigate(from, { replace: true });
    };

    return (
        <AuthShell metaTitle="Iniciar sesión" title="ENTRAR" subtitle="Inicia sesión para una experiencia curada.">
            {sessionExpired && (
                <p role="alert" className="rounded-2xl border border-status-warning/40 bg-status-warning-bg px-5 py-4 text-sm text-primary-champagne">
                    {SESSION_EXPIRED_MESSAGE}
                </p>
            )}

            {/* Login normal */}
            <LoginForm onSuccess={handleSuccess} />

            {/* SFTWRKEY-428 */}
            <div className="text-center mt-6">
                <Link
                    to="/recuperar-contrasena"
                    className="text-xs text-primary-champagne/60 underline underline-offset-4 hover:text-primary-gold transition-colors"
                >
                    ¿Olvidaste tu contraseña?
                </Link>
            </div>

            {/* Registro de clientes: conserva a dónde volver después de crear la cuenta */}
            <p className="text-center mt-6 text-sm text-primary-champagne/60">
                ¿No tienes cuenta?{" "}
                <Link
                    to="/registro"
                    state={fromState ? { from: fromState } : undefined}
                    className="font-black text-primary-gold underline underline-offset-4 hover:text-primary-champagne transition-colors"
                >
                    Crear cuenta
                </Link>
            </p>

            <AuthDivider />

            {/* Google */}
            <GoogleAccess linkMode={false} compact />

            {/* Explorar colección */}
            <div className="text-center mt-10">
                <Link
                    to="/perfumes"
                    className="inline-block text-xs font-black text-primary-gold uppercase tracking-widest hover:text-primary-champagne transition-all hover:scale-110"
                >
                    Explorar Colección
                </Link>
            </div>
        </AuthShell>
    );
}
