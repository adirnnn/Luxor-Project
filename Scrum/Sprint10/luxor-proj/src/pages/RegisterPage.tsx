import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { RegisterForm } from "../validation/RegisterForm";
import { login as loginRequest } from "../validation/authService";
import { GoogleAccess } from "../features/CommerceFeatures";
import { AuthDivider, AuthShell } from "../components/auth/AuthShell";

// Registro de clientes: cualquier persona crea su cuenta (el backend siempre la crea como CLIENTE).
// /register no deja la sesión iniciada (el admin usa la misma ruta para crear clientes), así que
// al terminar se inicia sesión con el mismo correo y contraseña.
export default function RegisterPage() {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [loginError, setLoginError] = useState<string | null>(null);

    // si venía de una página protegida (por ejemplo el pago), vuelve ahí al terminar
    const fromState = (location.state as { from?: { pathname?: string } } | null)?.from;
    const from = fromState?.pathname || "/";

    if (isAuthenticated) {
        return <Navigate to={from} replace />;
    }

    const handleRegistered = async (_user: unknown, credentials: { email: string; password: string }) => {
        const result = await loginRequest(credentials);
        if (result.success && result.user) {
            login(result.user);
            navigate(from, { replace: true });
        } else {
            // la cuenta sí se creó: solo falta entrar
            setLoginError("Tu cuenta se creó, pero no pudimos iniciar la sesión. Entra con tu correo y tu contraseña.");
        }
    };

    return (
        <AuthShell metaTitle="Crear cuenta" title="CREAR CUENTA" subtitle="Guarda tu carrito, sigue tus pedidos y califica tus perfumes.">
            {loginError ? (
                <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-status-warning/40 bg-status-warning-bg px-5 py-4 text-sm text-primary-champagne">
                    <p>{loginError}</p>
                    <Link
                        to="/login"
                        state={fromState ? { from: fromState } : undefined}
                        className="font-black text-primary-gold underline underline-offset-4"
                    >
                        Ir a iniciar sesión
                    </Link>
                </div>
            ) : (
                <RegisterForm onSuccess={handleRegistered} />
            )}

            <p className="text-center mt-6 text-sm text-primary-champagne/60">
                ¿Ya tienes cuenta?{" "}
                <Link
                    to="/login"
                    state={fromState ? { from: fromState } : undefined}
                    className="font-black text-primary-gold underline underline-offset-4 hover:text-primary-champagne transition-colors"
                >
                    Inicia sesión
                </Link>
            </p>

            <AuthDivider />

            {/* Google crea la cuenta sola si el correo es nuevo (cuando esté configurado) */}
            <GoogleAccess linkMode={false} compact />
        </AuthShell>
    );
}
