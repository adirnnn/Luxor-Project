import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Container } from "../components/ui/Container";
import { H1, H2, H3, Text } from "../components/ui/Typography";
import { useAuth } from "../context/AuthContext";
import { API_URL, authHeaders, getToken } from "../services/apiClient";

interface OrderItem {
  product_id: string;
  name: string;
  image: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: number;
  total: number;
  status: string;
  created_at: string;
  items: OrderItem[];
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

// SFTWRKEY-325: Colores según el estado del pedido
const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completado",
  cancelled: "Cancelado",
};

export default function UserPage() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const navigate = useNavigate();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [errorOrders, setErrorOrders] = useState<string | null>(null);

  // SFTWRKEY-324: Qué orden está expandida mostrando el detalle
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // SFTWRKEY-321: Estado del formulario de edición de datos personales
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMessage, setInfoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // SFTWRKEY-322: Estado del formulario de cambio de contraseña
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // SFTWRKEY-322: Mostrar/ocultar contraseña, igual que en el login
  const [showPasswords, setShowPasswords] = useState(false);

  // SFTWRKEY-233: Validar sesión activa
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const loadUserInfo = () => {
    setLoadingInfo(true);
    fetch(`${API_URL}/user/${user.id}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener datos del usuario");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setUserInfo(data.user);
          setEditName(data.user.name);
          setEditEmail(data.user.email);
        } else {
          setErrorInfo("No se pudo obtener la información del usuario.");
        }
      })
      .catch(() => setErrorInfo("Error de conexión al obtener información."))
      .finally(() => setLoadingInfo(false));
  };

  // SFTWRKEY-230/231: Endpoint de historial + conectar frontend
  useEffect(() => {
    loadUserInfo();

    // SFTWRKEY-323: Historial real de pedidos (orders + order_items)
    fetch(`${API_URL}/user/${user.id}/orders`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener historial");
        return res.json();
      })
      .then((data) => {
        if (data.success) setOrders(data.orders);
        else setErrorOrders("No se pudo obtener el historial.");
      })
      .catch(() => setErrorOrders("Error de conexión al obtener historial."))
      .finally(() => setLoadingOrders(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const totalSpent = orders.reduce((sum, o) => sum + Number(o.total), 0);

  // SFTWRKEY-321: Validar formato de correo en el navegador antes de llamar al backend
  const handleSaveInfo = async (e: FormEvent) => {
    e.preventDefault();
    setInfoMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail)) {
      setInfoMessage({ type: "error", text: "Ingresa un correo con formato válido (ej: nombre@dominio.com)." });
      return;
    }
    if (editName.trim().length < 2) {
      setInfoMessage({ type: "error", text: "El nombre debe tener al menos 2 caracteres." });
      return;
    }

    setSavingInfo(true);
    try {
      const res = await fetch(`${API_URL}/user/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: editName, email: editEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setInfoMessage({ type: "error", text: data.message || "No se pudo actualizar la información." });
        return;
      }
      setUserInfo(data.user);
      // Actualiza también la sesión (para que el nombre se refleje en toda la app)
      const token = getToken();
      if (token) login({ ...user, name: data.user.name, email: data.user.email }, token);
      setInfoMessage({ type: "success", text: "Información actualizada correctamente." });
      setIsEditingInfo(false);
    } catch {
      setInfoMessage({ type: "error", text: "Error de conexión. Intenta de nuevo." });
    } finally {
      setSavingInfo(false);
    }
  };

  // SFTWRKEY-322: Guardar nueva contraseña
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "La nueva contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Las contraseñas nuevas no coinciden." });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`${API_URL}/user/${user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPasswordMessage({ type: "error", text: data.message || "No se pudo cambiar la contraseña." });
        return;
      }
      setPasswordMessage({ type: "success", text: "Contraseña actualizada. Por seguridad, vuelve a iniciar sesión..." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsChangingPassword(false);
      // SFTWRKEY-322: Por seguridad, cerramos la sesión tras cambiar la contraseña
      setTimeout(() => {
        logout();
        navigate("/login");
      }, 1800);
    } catch {
      setPasswordMessage({ type: "error", text: "Error de conexión. Intenta de nuevo." });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <MainLayout>
      <Container className="py-12">
        <H1 className="mb-10">Mi Cuenta</H1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Panel izquierdo: info + edición + contraseña */}
          <div className="lg:col-span-1 flex flex-col gap-6">
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

              {loadingInfo ? (
                <Spinner />
              ) : errorInfo ? (
                <p className="text-sm text-red-400 text-center">{errorInfo}</p>
              ) : userInfo ? (
                isEditingInfo ? (
                  <form onSubmit={handleSaveInfo} className="flex flex-col gap-4 text-sm">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-white/40 uppercase tracking-widest">Nombre</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-gold"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-white/40 uppercase tracking-widest">Correo</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="bg-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-gold"
                        required
                      />
                    </div>

                    {infoMessage && (
                      <p className={`text-xs ${infoMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                        {infoMessage.text}
                      </p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={savingInfo}
                        className="flex-1 bg-primary-gold text-primary-black font-bold rounded-lg py-2 text-xs uppercase tracking-widest disabled:opacity-50"
                      >
                        {savingInfo ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingInfo(false);
                          setEditName(userInfo.name);
                          setEditEmail(userInfo.email);
                          setInfoMessage(null);
                        }}
                        className="flex-1 bg-white/10 text-white rounded-lg py-2 text-xs uppercase tracking-widest"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
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

                    {infoMessage && (
                      <p className={`text-xs ${infoMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                        {infoMessage.text}
                      </p>
                    )}

                    <button
                      onClick={() => setIsEditingInfo(true)}
                      className="mt-1 border border-primary-gold text-primary-gold rounded-lg py-2 text-xs uppercase tracking-widest hover:bg-primary-gold hover:text-primary-black transition-colors"
                    >
                      Editar información
                    </button>
                  </div>
                )
              ) : null}

              <div className="h-px bg-white/10" />

              {/* SFTWRKEY-322: Cambiar contraseña */}
              {isChangingPassword ? (
                <form onSubmit={handleChangePassword} className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-end -mb-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswords((prev) => !prev)}
                      className="text-[10px] uppercase tracking-widest text-white/40 hover:text-primary-gold transition-colors flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {showPasswords ? (
                          <>
                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                      {showPasswords ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40 uppercase tracking-widest">Contraseña actual</label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-gold"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40 uppercase tracking-widest">Nueva contraseña</label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-gold"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-white/40 uppercase tracking-widest">Confirmar nueva contraseña</label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-gold"
                      required
                    />
                  </div>

                  {passwordMessage && (
                    <p className={`text-xs ${passwordMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                      {passwordMessage.text}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="flex-1 bg-primary-gold text-primary-black font-bold rounded-lg py-2 text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                      {savingPassword ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                        setPasswordMessage(null);
                      }}
                      className="flex-1 bg-white/10 text-white rounded-lg py-2 text-xs uppercase tracking-widest"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className="border border-white/20 text-white/70 rounded-lg py-2 text-xs uppercase tracking-widest hover:border-primary-gold hover:text-primary-gold transition-colors"
                >
                  Cambiar contraseña
                </button>
              )}

              <div className="h-px bg-white/10" />

              {/* Resumen */}
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Pedidos realizados</span>
                  <span className="font-bold text-primary-gold">{orders.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Total acumulado</span>
                  <span className="font-bold text-primary-gold">Q{totalSpent.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <H2>Historial de Pedidos</H2>

            {loadingOrders ? (
              <Spinner />
            ) : errorOrders ? (
              <div className="py-10 text-center bg-white/30 rounded-3xl border border-primary-beige">
                <p className="text-red-500 text-sm">{errorOrders}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-20 text-center bg-white/30 rounded-3xl border border-primary-beige">
                <Text>Aún no tienes pedidos registrados.</Text>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {orders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const badgeClass = statusStyles[order.status] ?? "bg-white/10 text-white/70 border-white/20";
                  const badgeLabel = statusLabels[order.status] ?? order.status;

                  return (
                    <div key={order.id} className="bg-white/70 rounded-2xl border border-primary-beige overflow-hidden">
                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full flex items-center justify-between gap-4 p-5 text-left"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-primary-black">Pedido #{order.id}</span>
                          <span className="text-xs text-secondary-brown">
                            {new Date(order.created_at).toLocaleDateString("es-GT", {
                              day: "2-digit", month: "long", year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                          <span className="font-bold text-primary-gold">Q{Number(order.total).toFixed(2)}</span>
                          <svg
                            className={`text-secondary-brown transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-primary-beige px-5 py-4 flex flex-col gap-3 bg-white/40">
                          {order.items.map((item, i) => (
                            <div key={`${item.product_id}-${i}`} className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-primary-champagne rounded-lg overflow-hidden flex-shrink-0 p-1.5">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-contain mix-blend-multiply"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='1.5'><circle cx='12' cy='8' r='3'/><path d='M4 20c0-4 4-6 8-6s8 2 8 6'/></svg>";
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <H3 className="text-sm truncate">{item.name}</H3>
                                <p className="text-xs text-secondary-brown mt-0.5">Cantidad: {item.quantity}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-primary-gold text-sm">Q{Number(item.unit_price).toFixed(2)}</p>
                                <p className="text-xs text-secondary-brown">c/u</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Container>
    </MainLayout>
  );
}