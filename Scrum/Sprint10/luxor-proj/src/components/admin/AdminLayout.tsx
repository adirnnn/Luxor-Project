import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  BadgePercent, BarChart3, Boxes, LayoutDashboard, LogOut, Menu, Moon, PackagePlus, ShieldAlert,
  ShoppingBag, Star, Store, Sun, Ticket, Upload, Users, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchAdminSummary, type AdminSummary } from "../../services/adminConsoleService";

// Consola del admin: menú lateral (como un CRM), barra superior con modo claro/oscuro y el contenido.
// El tema cambia las variables de color (styles/globals.css), así que todas las pantallas del admin
// lo respetan aunque se hayan hecho para la tienda oscura.
export type AdminTheme = "light" | "dark";
const TEMA_KEY = "luxor_admin_tema";

function temaInicial(): AdminTheme {
  try {
    const guardado = localStorage.getItem(TEMA_KEY);
    if (guardado === "light" || guardado === "dark") return guardado;
  } catch {
    // sin almacenamiento se usa el del sistema
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

type NavItem = { to: string; label: string; icon: typeof Store; badge?: (s: AdminSummary) => number; tono?: "attention" | "error"; match?: RegExp };
const GRUPOS: { titulo: string; items: NavItem[] }[] = [
  { titulo: "General", items: [{ to: "/admin", label: "Resumen", icon: LayoutDashboard, match: /^\/admin$/ }] },
  {
    titulo: "Ventas",
    items: [
      { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag, badge: (s) => s.pedidos.por_preparar, tono: "attention" },
      { to: "/admin/cupones", label: "Cupones", icon: Ticket },
      { to: "/reporte", label: "Reportes", icon: BarChart3 },
    ],
  },
  {
    titulo: "Catálogo",
    items: [
      { to: "/admin/inventario", label: "Inventario", icon: Boxes, badge: (s) => s.productos.agotados, tono: "error", match: /^\/admin\/(inventario|editar)/ },
      { to: "/admin/nuevo", label: "Nuevo perfume", icon: PackagePlus, match: /^\/admin\/nuevo$/ },
      { to: "/admin/importar", label: "Importar CSV", icon: Upload },
      { to: "/admin/resenas", label: "Reseñas", icon: Star },
    ],
  },
  {
    titulo: "Clientes",
    items: [
      { to: "/admin/clientes", label: "Clientes", icon: Users, match: /^\/admin\/(clientes|nuevo-usuario)/ },
      { to: "/admin/mayoristas", label: "Mayoristas", icon: BadgePercent },
    ],
  },
  { titulo: "Sistema", items: [{ to: "/admin/seguridad", label: "Seguridad", icon: ShieldAlert }] },
];

const activo = (item: NavItem, path: string) => (item.match ? item.match.test(path) : path.startsWith(item.to));

export function AdminLayout({ children, title }: { children: ReactNode; title?: string; fullBleed?: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tema, setTema] = useState<AdminTheme>(temaInicial);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [resumen, setResumen] = useState<AdminSummary | null>(null);

  // los números de los avisos del menú se actualizan al cambiar de pantalla
  useEffect(() => {
    let vivo = true;
    fetchAdminSummary().then((s) => vivo && setResumen(s)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, [pathname]);

  const cambiarTema = () => {
    const nuevo = tema === "light" ? "dark" : "light";
    setTema(nuevo);
    try {
      localStorage.setItem(TEMA_KEY, nuevo);
    } catch {
      // se queda solo en esta visita
    }
  };

  const seccion = GRUPOS.flatMap((g) => g.items).find((i) => activo(i, pathname))?.label ?? "Consola";

  const menu = (
    <nav aria-label="Consola del administrador" className="flex flex-col gap-6">
      {GRUPOS.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-champagne/45">{grupo.titulo}</p>
          {grupo.items.map((item) => {
            const Icono = item.icon;
            const n = resumen && item.badge ? item.badge(resumen) : 0;
            const esActivo = activo(item, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuAbierto(false)}
                aria-current={esActivo ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  esActivo
                    ? "bg-primary-gold/15 text-primary-gold"
                    : "text-primary-champagne/75 hover:bg-white/5 hover:text-primary-champagne"
                )}
              >
                <Icono size={18} aria-hidden className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {n > 0 && (
                  <span
                    className={clsx(
                      "min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] font-bold",
                      item.tono === "error" ? "bg-status-error text-white" : "bg-status-attention text-primary-black"
                    )}
                    aria-label={`${n} ${item.tono === "error" ? "agotados" : "por atender"}`}
                  >
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const pie = (
    <div className="flex flex-col gap-1 border-t border-white/10 pt-4">
      <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-primary-champagne/75 hover:bg-white/5">
        <Store size={18} aria-hidden /> Ver la tienda
      </Link>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/");
        }}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-primary-champagne/75 hover:bg-white/5"
      >
        <LogOut size={18} aria-hidden /> Salir
      </button>
    </div>
  );

  const marca = (
    <Link to="/admin" className="flex items-baseline gap-2 px-3">
      <span className="font-brand text-2xl text-primary-gold">victoria</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-champagne/50">Consola</span>
    </Link>
  );

  return (
    <div data-theme={tema} className="admin-console min-h-screen bg-primary-black font-sans text-primary-champagne">
      {/* menú lateral en computadora */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-6 overflow-y-auto border-r border-white/10 bg-secondary-charcoal px-3 py-6 lg:flex">
        {marca}
        <div className="flex-1">{menu}</div>
        {pie}
      </aside>

      {/* menú en celular */}
      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de la consola">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/50" onClick={() => setMenuAbierto(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-secondary-charcoal px-3 py-6">
            <div className="flex items-center justify-between pr-2">
              {marca}
              <button type="button" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="rounded-lg p-2 hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1">{menu}</div>
            {pie}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-primary-black/90 px-4 backdrop-blur md:px-8">
          <button type="button" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="rounded-lg p-2 hover:bg-white/5 lg:hidden">
            <Menu size={20} />
          </button>
          {/* las pantallas nuevas pasan su título (es el h1); las de antes traen su propio título y aquí
              solo se ve en qué sección está */}
          {title ? (
            <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
          ) : (
            <p className="flex-1 truncate text-sm text-primary-champagne/60">
              Consola <span aria-hidden>·</span> <span className="font-semibold text-primary-champagne">{seccion}</span>
            </p>
          )}
          <button
            type="button"
            onClick={cambiarTema}
            aria-label={tema === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
            title={tema === "light" ? "Modo oscuro" : "Modo claro"}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
          >
            {tema === "light" ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
            <span className="hidden sm:inline">{tema === "light" ? "Oscuro" : "Claro"}</span>
          </button>
          <span className="hidden max-w-[12rem] truncate text-sm text-primary-champagne/60 md:inline">{user?.name}</span>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
