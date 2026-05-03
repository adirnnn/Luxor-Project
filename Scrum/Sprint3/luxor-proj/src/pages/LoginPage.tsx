import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoginForm } from "../validation/LoginForm";
import type { AuthUser } from "../validation/authService";

export default function LoginPage() {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // Si ya está autenticado, redirigir al inicio
    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const handleSuccess = (user: AuthUser) => {
        login(user);
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-primary-champagne flex">
            {/* ── Left panel: decorative image (hidden on mobile) ── */}
            <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1585386959984-a4155224a1ad?q=80&w=1400&auto=format&fit=crop"
                    alt="Perfumes de lujo"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-primary-black/60 to-primary-black/20" />

                {/* Brand overlay */}
                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    <span className="font-heading text-white text-lg tracking-widest">
                        Joyero Árabe
                    </span>
                    <div>
                        <p className="font-heading text-white text-3xl leading-tight mb-3">
                            "El aroma correcto
                            <br />
                            abre puertas."
                        </p>
                        <span className="text-xs text-white/60 tracking-widest uppercase">
                            Acceso exclusivo
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Right panel: form ── */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
                {/* Mobile brand */}
                <div className="md:hidden mb-10 text-center">
                    <span className="font-heading text-2xl tracking-wide text-primary-black">
                        Joyero Árabe
                    </span>
                </div>

                <div className="w-full max-w-sm">
                    {/* Header */}
                    <div className="mb-10">
                        <h1 className="font-heading text-[2rem] leading-tight text-primary-black mb-2">
                            Bienvenido
                        </h1>
                        <p className="text-sm text-secondary-brown">
                            Inicia sesión para continuar
                        </p>
                    </div>

                    <LoginForm onSuccess={handleSuccess} />
                </div>
            </div>
        </div>
    );
}