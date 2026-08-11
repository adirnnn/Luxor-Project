import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LoginForm } from "../validation/LoginForm";
import type { AuthUser } from "../validation/authService";
import { Link } from "react-router-dom";

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
        <div className="min-h-screen bg-primary-black flex text-primary-champagne">
            {/* ── Left panel: decorative image (hidden on mobile) ── */}
            <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
                <img
                    src="https://images.unsplash.com/photo-1585386959984-a4155224a1ad?q=80&w=1400&auto=format&fit=crop"
                    alt="Perfumes de lujo"
                    className="absolute inset-0 w-full h-full object-cover grayscale opacity-40"
                />
                <div className="absolute inset-0 cinematic-overlay" />

                {/* Brand overlay */}
                <div className="relative z-10 flex flex-col justify-between p-20 w-full">
                    <div className="flex flex-col leading-none">
                        <span className="text-primary-gold font-heading text-4xl font-light uppercase tracking-tight">Habibi</span>
                        <span className="text-primary-champagne/30 font-heading text-lg font-light uppercase tracking-[0.25em] ml-1 mt-2">Parfums</span>
                    </div>
                    <div>
                        <p className="font-heading text-primary-champagne text-5xl lg:text-6xl leading-tight mb-8 font-light italic uppercase tracking-tighter">
                            El Aroma
                            <br />
                            es Poder.
                        </p>
                        <span className="text-xs text-primary-gold tracking-[0.4em] uppercase font-bold">
                            ACCESO EXCLUSIVO
                        </span>
                    </div>
                </div>
            </div>

            {/* Form panel */}
                <div className="flex flex-1 flex-col min-h-screen md:min-h-0 bg-primary-black">

                    {/* Mobile header */}
                    <div className="md:hidden flex items-center justify-between px-8 py-8 border-b border-white/5 bg-primary-black/95 backdrop-blur-xl">
                    <Link
                        to="/"
                        className="flex flex-col leading-none"
                    >
                        <span className="text-primary-gold font-heading text-2xl font-light uppercase tracking-tight">Habibi</span>
                        <span className="text-primary-champagne/30 font-heading text-[8px] font-light uppercase tracking-[0.25em] ml-0.5 mt-1">Parfums</span>
                    </Link>
                    <Link
                        to="/"
                        className="text-xs font-black uppercase text-primary-gold hover:text-primary-champagne transition-all"
                        >
                        Inicio
                    </Link>
                    </div>

                    {/* Form content */}
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
                    <div className="w-full max-w-sm">
                    {/* Header */}
                    <div className="mb-14">
                        <h1 className="font-heading text-5xl leading-none text-primary-gold mb-4 font-black uppercase tracking-tighter">
                            ENTRAR
                        </h1>
                        <p className="text-lg text-primary-champagne/50 font-medium">
                            Inicia sesión para una experiencia curada.
                        </p>
                    </div>

                    <LoginForm onSuccess={handleSuccess} />

                    {/* Divider */}
                    <div className="relative flex items-center gap-4 my-10">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs tracking-[0.3em] uppercase text-primary-gold font-black">o</span>
                    <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <div className="text-center">
                    <Link
                        to="/perfumes"
                        className="inline-block text-xs font-black text-primary-gold uppercase tracking-widest hover:text-primary-champagne transition-all hover:scale-110"
                    >
                        Explorar Colección
                    </Link>
                    </div>
                </div>

                {/* Bottom nav hint */}
                <p className="mt-10 text-[10px] text-secondary-brown/50 text-center">
                    Al continuar, aceptas nuestros términos de uso y política de privacidad.
                </p>
            </div>
        </div>
    </div>
    );
}