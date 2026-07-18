import { useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { H1, Text } from "../components/ui/Typography";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface FormData {
  name: string;
  email: string;
  password: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

// SFTWRKEY-220: Crear usuario con inputs nombre/email/password
export default function AdminCreateUserPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isAuthenticated || user?.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = "El nombre es requerido.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) newErrors.email = "El correo es requerido.";
    else if (!emailRegex.test(formData.email)) newErrors.email = "Formato de correo inválido.";
    if (!formData.password) newErrors.password = "La contraseña es requerida.";
    else if (formData.password.length < 6) newErrors.password = "Mínimo 6 caracteres.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
    setServerError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => navigate("/admin"), 1500);
      } else {
        // SFTWRKEY-223: Mostrar error de email duplicado
        setServerError(data.message || "No se pudo crear el usuario.");
      }
    } catch {
      setServerError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <Section size="lg" className="min-h-screen pt-32 pb-20">
        <Container>
          <div className="max-w-2xl mx-auto flex flex-col gap-12">
            <div className="flex flex-col gap-2">
              <H1 className="text-primary-gold mb-2 font-light italic uppercase tracking-tighter">Registrar Cliente</H1>
              <Text className="text-primary-champagne/40 font-black uppercase tracking-[0.3em] text-xs italic">Añadir a la Comunidad Habibi</Text>
            </div>

            {success && (
              <div className="p-6 glass-card border-green-500/20 text-green-500 text-center font-bold italic">
                ¡Usuario creado exitosamente! Redirigiendo...
              </div>
            )}

            {serverError && (
              <div className="p-6 glass-card border-red-500/20 text-red-500 text-center font-bold italic">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="glass-card p-10 md:p-16 flex flex-col gap-10 border-white/5" noValidate>

              {/* Nombre */}
              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">
                  Nombre de Usuario
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ej: Juan Pérez"
                  className={clsx(
                    "w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-primary-black/40",
                    "placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300",
                    errors.name ? "ring-2 ring-red-500 bg-red-500/10" : ""
                  )}
                />
                {errors.name && <span className="text-xs text-red-500 font-bold italic">{errors.name}</span>}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">
                  Identidad Digital (Email)
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                  className={clsx(
                    "w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-primary-black/40",
                    "placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300",
                    errors.email ? "ring-2 ring-red-500 bg-red-500/10" : ""
                  )}
                />
                {errors.email && <span className="text-xs text-red-500 font-bold italic">{errors.email}</span>}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-gold italic">
                  Llave Maestra (Contraseña)
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  className={clsx(
                    "w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-primary-black/40",
                    "placeholder:text-white/10 focus:ring-2 focus:ring-primary-gold transition-all duration-300",
                    errors.password ? "ring-2 ring-red-500 bg-red-500/10" : ""
                  )}
                />
                {errors.password && <span className="text-xs text-red-500 font-bold italic">{errors.password}</span>}
              </div>

              <div className="flex flex-col sm:flex-row gap-6 pt-6">
                <Button type="submit" className="flex-1 py-6 shadow-[0_20px_50px_rgba(212,175,55,0.2)]" disabled={loading}>
                  {loading ? "Registrando..." : "Crear Usuario"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/admin")} className="px-12 py-6">
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </Container>
      </Section>
    </MainLayout>
  );
}
