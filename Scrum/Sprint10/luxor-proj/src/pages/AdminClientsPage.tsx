import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { BadgePercent, ChevronLeft, ChevronRight, Search, Trash2, UserPlus } from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";
import { PageMeta } from "../components/seo/PageMeta";
import { deleteClient, fetchClients, type AdminClient } from "../services/adminConsoleService";
import { formatPrice } from "../utils/formatPrice";

// Clientes de la consola: buscar por nombre o correo, filtrar por rol, ver cuánto ha comprado cada
// uno y borrar cuentas (nunca la de un administrador).
const ROLES = [
  { valor: "", label: "Todos" },
  { valor: "CLIENTE", label: "Clientes" },
  { valor: "MAYORISTA", label: "Mayoristas" },
  { valor: "ADMIN", label: "Administradores" },
];
const ROL_ESTILO: Record<AdminClient["role"], string> = {
  CLIENTE: "bg-white/10 text-primary-champagne/80 border-white/15",
  MAYORISTA: "bg-status-transit-bg text-status-transit border-status-transit/40",
  ADMIN: "bg-primary-gold/15 text-primary-gold border-primary-gold/40",
};
const ROL_TEXTO: Record<AdminClient["role"], string> = { CLIENTE: "Cliente", MAYORISTA: "Mayorista", ADMIN: "Admin" };
const PAGE_SIZE = 25;
const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric" }) : "Nunca");

export default function AdminClientsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const role = params.get("role") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const clave = params.toString();

  const [data, setData] = useState<{ clave: string; users?: AdminClient[]; total?: number; error?: string } | null>(null);
  const [texto, setTexto] = useState(q);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [recarga, setRecarga] = useState(0);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(espera.current), []);

  useEffect(() => {
    let vivo = true;
    const p = new URLSearchParams(clave);
    fetchClients({ q: p.get("q") ?? "", role: p.get("role") ?? "", page: Math.max(1, Number(p.get("page")) || 1), pageSize: PAGE_SIZE })
      .then((d) => vivo && setData({ clave, users: d.users, total: d.total }))
      .catch((e: Error) => vivo && setData({ clave, error: e.message }));
    return () => {
      vivo = false;
    };
  }, [clave, recarga]);

  const cambiar = (cambios: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in cambios)) next.delete("page");
    setParams(next);
  };

  const borrar = async (c: AdminClient) => {
    const ok = window.confirm(
      `¿Borrar la cuenta de ${c.name} (${c.email})?\n\nSus pedidos se quedan en los reportes como "Cuenta eliminada"; ` +
        "su carrito, favoritos y reseñas se borran. No se puede deshacer."
    );
    if (!ok) return;
    try {
      await deleteClient(c.id);
      setAviso({ ok: true, texto: `Se borró la cuenta de ${c.name}.` });
      setRecarga((n) => n + 1);
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
  };

  const actual = data?.clave === clave ? data : undefined;
  const total = actual?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout title="Clientes">
      <PageMeta title="Clientes" noindex />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-primary-champagne/60">{actual?.users ? `${total} ${total === 1 ? "cuenta" : "cuentas"}` : "Cargando…"}</p>
          <div className="flex gap-2">
            <Link to="/admin/mayoristas" className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5">
              <BadgePercent size={16} aria-hidden /> Mayoristas
            </Link>
            <Link to="/admin/nuevo-usuario" className="flex items-center gap-2 rounded-lg bg-primary-gold px-4 py-2 text-sm font-semibold text-primary-black hover:opacity-90">
              <UserPlus size={16} aria-hidden /> Nuevo cliente
            </Link>
          </div>
        </div>

        <div role="tablist" aria-label="Filtrar por rol" className="flex gap-1 overflow-x-auto border-b border-white/10">
          {ROLES.map((r) => (
            <button
              key={r.label}
              role="tab"
              aria-selected={role === r.valor}
              onClick={() => cambiar({ role: r.valor })}
              className={clsx(
                "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold",
                role === r.valor ? "border-primary-gold text-primary-gold" : "border-transparent text-primary-champagne/60 hover:text-primary-champagne"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="relative max-w-md">
          <span className="sr-only">Buscar cliente</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-champagne/50" />
          <input
            type="search"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              clearTimeout(espera.current);
              const v = e.target.value.trim();
              espera.current = setTimeout(() => cambiar({ q: v }), 300);
            }}
            placeholder="Buscar por nombre o correo"
            className="h-10 w-full rounded-lg border border-white/15 bg-secondary-charcoal pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-gold"
          />
        </label>

        {aviso && (
          <p role="status" className={clsx("rounded-lg px-4 py-3 text-sm", aviso.ok ? "bg-status-success-bg text-status-success" : "bg-status-error-bg text-status-error")}>
            {aviso.texto}
          </p>
        )}
        {actual?.error && <p role="alert" className="rounded-lg bg-status-error-bg px-4 py-3 text-sm text-status-error">{actual.error}</p>}

        <section aria-label="Cuentas" aria-busy={!actual} className={clsx("glass-card !rounded-xl overflow-x-auto", !actual && "opacity-60")}>
          {actual?.users && actual.users.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-primary-champagne/60">Ninguna cuenta coincide.</p>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-primary-champagne/55">
                <tr>
                  <th className="px-5 py-3 font-semibold">Cliente</th>
                  <th className="px-3 py-3 font-semibold">Rol</th>
                  <th className="px-3 py-3 text-right font-semibold">Pedidos</th>
                  <th className="px-3 py-3 text-right font-semibold">Ha comprado</th>
                  <th className="px-3 py-3 font-semibold">Último pedido</th>
                  <th className="px-3 py-3 font-semibold">Alta</th>
                  <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {(actual?.users ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-5 py-3">
                      <p className="font-semibold">{c.name}</p>
                      <p className="flex items-center gap-2 text-xs text-primary-champagne/60">
                        {c.email}
                        {!c.email_verified && (
                          <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-semibold text-status-warning">Sin confirmar</span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={clsx("rounded-full border px-2.5 py-0.5 text-xs font-semibold", ROL_ESTILO[c.role])}>{ROL_TEXTO[c.role]}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{c.pedidos}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatPrice(c.gastado)}</td>
                    <td className="px-3 py-3 text-primary-champagne/75">{fecha(c.ultimo_pedido)}</td>
                    <td className="px-3 py-3 text-primary-champagne/75">{fecha(c.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      {c.role === "ADMIN" ? (
                        <span className="text-xs text-primary-champagne/45" title="Las cuentas de administrador no se pueden borrar">Protegida</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => borrar(c)}
                          aria-label={`Borrar la cuenta de ${c.name}`}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-status-error hover:bg-status-error-bg"
                        >
                          <Trash2 size={14} aria-hidden /> Borrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => cambiar({ page: String(page - 1) })} aria-label="Página anterior" className="rounded-lg border border-white/15 p-2 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <span className="tabular-nums">{page} / {paginas}</span>
            <button type="button" disabled={page >= paginas} onClick={() => cambiar({ page: String(page + 1) })} aria-label="Página siguiente" className="rounded-lg border border-white/15 p-2 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
