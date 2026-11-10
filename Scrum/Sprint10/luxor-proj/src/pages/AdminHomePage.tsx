import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { AlertTriangle, PackagePlus, PackageX, ShoppingBag, Ticket, TrendingUp, Truck, Upload, UserPlus, Users } from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";
import { PageMeta } from "../components/seo/PageMeta";
import { fetchAdminSummary, type AdminSummary } from "../services/adminConsoleService";
import { fetchAdminOrders, type AdminOrder } from "../services/orderService";
import { statusLabel, statusStyle } from "../constants/orderStatus";
import { formatPrice } from "../utils/formatPrice";

// Resumen de la consola: primero lo que hay que atender (como un CRM), cada tarjeta lleva a su lista
// ya filtrada; luego las acciones de siempre y los últimos pedidos.
type Tono = "attention" | "error" | "warning" | "success" | "transit" | "neutral";
const TONOS: Record<Tono, string> = {
  attention: "border-l-status-attention text-status-attention",
  error: "border-l-status-error text-status-error",
  warning: "border-l-status-warning text-status-warning",
  success: "border-l-status-success text-status-success",
  transit: "border-l-status-transit text-status-transit",
  neutral: "border-l-primary-gold text-primary-gold",
};

function Tarjeta({ to, titulo, valor, detalle, tono, icono: Icono }: {
  to: string; titulo: string; valor: string | number; detalle: string; tono: Tono; icono: typeof ShoppingBag;
}) {
  return (
    <Link
      to={to}
      className={clsx(
        "glass-card !rounded-xl border-l-4 p-5 flex flex-col gap-2 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold",
        TONOS[tono]
      )}
    >
      <span className="flex items-center justify-between text-sm font-medium text-primary-champagne/70">
        {titulo}
        <Icono size={18} aria-hidden />
      </span>
      <span className="text-3xl font-semibold text-primary-champagne tabular-nums">{valor}</span>
      <span className="text-xs text-primary-champagne/60">{detalle}</span>
    </Link>
  );
}

const ACCIONES = [
  { to: "/admin/nuevo", label: "Nuevo perfume", icon: PackagePlus },
  { to: "/admin/importar", label: "Importar CSV", icon: Upload },
  { to: "/admin/nuevo-usuario", label: "Nuevo cliente", icon: UserPlus },
  { to: "/admin/cupones", label: "Crear cupón", icon: Ticket },
];

export default function AdminHomePage() {
  const [resumen, setResumen] = useState<AdminSummary | null>(null);
  const [pedidos, setPedidos] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminSummary().then(setResumen).catch((e: Error) => setError(e.message));
    fetchAdminOrders({ limit: 6 }).then((d) => setPedidos(d.orders)).catch(() => setPedidos([]));
  }, []);

  const hoy = new Date().toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <AdminLayout title="Resumen">
      <PageMeta title="Consola" noindex />
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-sm capitalize text-primary-champagne/60">{hoy}</p>
          <h2 className="text-2xl font-semibold">Lo que necesita tu atención</h2>
        </div>

        {error && <p role="alert" className="rounded-lg bg-status-error-bg px-4 py-3 text-sm text-status-error">{error}</p>}

        {resumen && (
          <section aria-label="Indicadores" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Tarjeta
              to="/admin/pedidos?estado=pagado"
              titulo="Pedidos por preparar"
              valor={resumen.pedidos.por_preparar}
              detalle={resumen.pedidos.por_preparar ? "Pagados, esperan que los empaques" : "Todo al día"}
              tono={resumen.pedidos.por_preparar ? "attention" : "success"}
              icono={ShoppingBag}
            />
            <Tarjeta
              to="/admin/inventario?stock=agotado"
              titulo="Agotados"
              valor={resumen.productos.agotados}
              detalle={resumen.productos.agotados ? "Sin unidades: no se pueden comprar" : "Ningún perfume agotado"}
              tono={resumen.productos.agotados ? "error" : "success"}
              icono={PackageX}
            />
            <Tarjeta
              to="/admin/inventario?stock=bajo"
              titulo="Última unidad"
              valor={resumen.productos.bajo}
              detalle="La siguiente venta los agota"
              tono={resumen.productos.bajo ? "warning" : "success"}
              icono={AlertTriangle}
            />
            <Tarjeta
              to="/reporte"
              titulo="Ventas de hoy"
              valor={formatPrice(resumen.hoy.ventas)}
              detalle={`${resumen.hoy.pedidos} ${resumen.hoy.pedidos === 1 ? "pedido" : "pedidos"} hoy`}
              tono="success"
              icono={TrendingUp}
            />
            <Tarjeta
              to="/admin/pedidos?estado=enviado"
              titulo="En camino"
              valor={resumen.pedidos.enviados}
              detalle={`${resumen.pedidos.en_preparacion} en preparación`}
              tono="transit"
              icono={Truck}
            />
            <Tarjeta
              to="/admin/clientes"
              titulo="Clientes"
              valor={resumen.clientes.total}
              detalle={`${resumen.clientes.nuevos} nuevos esta semana`}
              tono="neutral"
              icono={Users}
            />
          </section>
        )}

        <section aria-labelledby="acciones" className="flex flex-col gap-3">
          <h2 id="acciones" className="text-sm font-semibold uppercase tracking-[0.12em] text-primary-champagne/60">Acciones rápidas</h2>
          <div className="flex flex-wrap gap-3">
            {ACCIONES.map(({ to, label, icon: Icono }) => (
              <Link key={to} to={to} className="flex items-center gap-2 rounded-lg border border-white/10 bg-secondary-charcoal px-4 py-2.5 text-sm font-medium hover:border-primary-gold/50 hover:text-primary-gold">
                <Icono size={16} aria-hidden /> {label}
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="ultimos" className="glass-card !rounded-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 id="ultimos" className="font-semibold">Últimos pedidos</h2>
            <Link to="/admin/pedidos" className="text-sm font-medium text-primary-gold hover:underline">Ver todos</Link>
          </div>
          {pedidos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-primary-champagne/60">Todavía no hay pedidos.</p>
          ) : (
            <ul>
              {pedidos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/5 px-5 py-3 text-sm last:border-0">
                  <span className="w-16 font-semibold tabular-nums">#{p.id}</span>
                  <span className="min-w-0 flex-1 truncate">{p.customer_name}</span>
                  <span className={clsx("rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusStyle(p.status))}>{statusLabel(p.status)}</span>
                  <span className="w-24 text-right font-semibold tabular-nums">{formatPrice(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
