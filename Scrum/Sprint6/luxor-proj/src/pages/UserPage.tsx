import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { H1, H2, H3, Text } from "../components/ui/Typography";
import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface Purchase {
  product_id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <svg className="animate-spin text-primary-gold" xmlns="http://www.w3.org/2000/svg"
      width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
    <p className="text-sm text-primary-champagne/70 tracking-wide">Cargando...</p>
  </div>
);

export default function UserPage() {
  const { user, isAuthenticated } = useAuth();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [errorPurchases, setErrorPurchases] = useState<string | null>(null);

  // SFTWRKEY-233: Validar sesión activa
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // SFTWRKEY-230: Endpoint historial + SFTWRKEY-231: Conectar frontend con endpoint
  useEffect(() => {
    // Fetch info del usuario
    fetch(`${API_URL}/user/${user.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener datos del usuario");
        return res.json();
      })
      .then((data) => {
        if (data.success) setUserInfo(data.user);
        else setErrorInfo("No se pudo obtener la información del usuario.");
      })
      .catch(() => setErrorInfo("Error de conexión al obtener información."))
      .finally(() => setLoadingInfo(false));

    // Fetch historial de compras
    fetch(`${API_URL}/user/${user.id}/purchases`)
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener historial");
        return res.json();
      })
      .then((data) => {
        if (data.success) setPurchases(data.purchases);
        else setErrorPurchases("No se pudo obtener el historial.");
      })
      .catch(() => setErrorPurchases("Error de conexión al obtener historial."))
      .finally(() => setLoadingPurchases(false));
  }, [user.id]);

  const totalSpent = purchases.reduce((sum, p) => sum + p.price * p.quantity, 0);

  // SFTWRKEY-232: Aplicar estilos UI
  return (
    <MainLayout>
      <Container className="py-12">
        <H1 className="mb-10">Mi Cuenta</H1>

        {/* ── SFTWRKEY-228: Mostrar información del usuario ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Panel izquierdo: info */}
          <div className="lg:col-span-1">
            <div className="bg-primary-black text-white p-8 rounded-3xl shadow-xl flex flex-col gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-primary-gold flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary-black">
                    {user.name?.charAt(0).toUpperCase() ?? "U"}
                  </span>
                </div>
                <div className="text-center">
                  <p className="font-heading text-lg">{user.name}</p>
                  <span className="text-xs text-white/50 uppercase tracking-widest">
                    {user.role ?? "Cliente"}
                  </span>
                </div>
              </div>

              <div className="h-px bg-white/10" />

              {/* Detalles */}
              {loadingInfo ? (
                <Spinner />
              ) : errorInfo ? (
                <p className="text-sm text-red-400 text-center">{errorInfo}</p>
              ) : userInfo ? (
                <div className="flex flex-col gap-4 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-white/40 uppercase tracking-widest">Nombre</span>
                    <span className="text-white">{userInfo.name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-white/40 uppercase tracking-widest">Correo</span>
                    <span className="text-white">{userInfo.email}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-white/40 uppercase tracking-widest">Rol</span>
                    <span className="text-white capitalize">{userInfo.role}</span>
                  </div>
                </div>
              ) : null}

              <div className="h-px bg-white/10" />

              {/* Resumen */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Productos en historial</span>
                  <span className="font-bold text-primary-gold">{purchases.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Total acumulado</span>
                  <span className="font-bold text-primary-gold">Q{totalSpent.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel derecho: historial */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <H2>Historial de Compras</H2>

            {loadingPurchases ? (
              <Spinner />
            ) : errorPurchases ? (
              <div className="py-10 text-center bg-white/30 rounded-3xl border border-primary-beige">
                <p className="text-red-500 text-sm">{errorPurchases}</p>
              </div>
            ) : purchases.length === 0 ? (
              <div className="py-20 text-center bg-white/30 rounded-3xl border border-primary-beige">
                <Text>Aún no tienes compras registradas.</Text>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {purchases.map((item, i) => (
                  <div key={`${item.product_id}-${i}`}
                    className="flex items-center gap-5 p-4 bg-white/70 rounded-2xl border border-primary-beige">
                    <div className="w-16 h-16 bg-primary-champagne rounded-xl overflow-hidden flex-shrink-0 p-2">
                      <img src={item.image} alt={item.name}
                        className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <H3 className="text-sm truncate">{item.name}</H3>
                      <p className="text-xs text-secondary-brown mt-0.5">
                        Cantidad: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-primary-gold">Q{item.price}</p>
                      <p className="text-xs text-secondary-brown">c/u</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Container>
    </MainLayout>
  );
}