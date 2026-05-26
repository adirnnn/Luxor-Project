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
      <Section size="lg">
        <Container>
          <div className="max-w-lg mx-auto flex flex-col gap-8">
            <div>
              <H1>Crear Usuario</H1>
              <Text>Registra un nuevo cliente en el sistema.</Text>
            </div>

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                ¡Usuario creado exitosamente! Redirigiendo...
              </div>
            )}

            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>

              {/* Nombre */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">
                  Nombre completo
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ej: Juan Pérez"
                  className={`bg-white border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold transition-colors ${
                    errors.name ? "border-red-400" : "border-primary-beige"
                  }`}
                />
                {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
              </div>

              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                  className={`bg-white border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold transition-colors ${
                    errors.email ? "border-red-400" : "border-primary-beige"
                  }`}
                />
                {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-secondary-brown">
                  Contraseña
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  className={`bg-white border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary-gold transition-colors ${
                    errors.password ? "border-red-400" : "border-primary-beige"
                  }`}
                />
                {errors.password && <span className="text-xs text-red-500">{errors.password}</span>}
              </div>

              <div className="flex gap-4 pt-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Creando..." : "Crear Usuario"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/admin")}>
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
