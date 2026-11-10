import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, PackagePlus, Pencil, Search, Trash2, Upload } from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";
import { PageMeta } from "../components/seo/PageMeta";
import {
  fetchInventory, updateStock, type InventoryItem, type InventoryPage, type InventorySort, type StockFilter,
} from "../services/adminConsoleService";
import { deleteProduct, fetchCategories, type Category } from "../services/productService";
import { fetchBrands } from "../services/catalogService";
import { formatPrice } from "../utils/formatPrice";

// Inventario de la consola: pestañas por stock con su cantidad, búsqueda, filtros y orden en la URL
// (así los enlaces del Resumen abren la lista ya filtrada y el botón atrás funciona), tabla densa
// y el stock se cambia ahí mismo.
const PESTAÑAS: { valor: StockFilter; label: string; clave: keyof InventoryPage["counts"]; activa: string }[] = [
  { valor: "", label: "Todos", clave: "todos", activa: "border-primary-gold text-primary-gold" },
  { valor: "agotado", label: "Agotados", clave: "agotado", activa: "border-status-error text-status-error" },
  { valor: "bajo", label: "Última unidad", clave: "bajo", activa: "border-status-warning text-status-warning" },
  { valor: "disponible", label: "Disponibles", clave: "disponible", activa: "border-status-success text-status-success" },
];

const ORDENES: { valor: InventorySort; label: string }[] = [
  { valor: "nombre", label: "Nombre (A a Z)" },
  { valor: "stock_asc", label: "Stock: menos primero" },
  { valor: "stock_desc", label: "Stock: más primero" },
  { valor: "precio_asc", label: "Precio: menor primero" },
  { valor: "precio_desc", label: "Precio: mayor primero" },
  { valor: "marca", label: "Marca" },
];

const control =
  "h-10 rounded-lg border border-white/15 bg-secondary-charcoal px-3 text-sm text-primary-champagne focus:outline-none focus:ring-2 focus:ring-primary-gold";

function StockBadge({ stock, lowStock }: { stock: number; lowStock: number }) {
  const [clase, texto] =
    stock <= 0
      ? ["bg-status-error-bg text-status-error border-status-error/40", "Agotado"]
      : stock <= lowStock
        ? ["bg-status-warning-bg text-status-warning border-status-warning/40", "Última"]
        : ["bg-status-success-bg text-status-success border-status-success/40", "Disponible"];
  return <span className={clsx("rounded-full border px-2 py-0.5 text-[11px] font-semibold", clase)}>{texto}</span>;
}

// número de stock editable: Enter o salir del campo guarda; Escape vuelve al valor anterior
function StockEditor({ item, onSaved }: { item: InventoryItem; onSaved: (stock: number, aviso: string | null) => void }) {
  const [valor, setValor] = useState(String(item.stock));
  const [estado, setEstado] = useState<"" | "guardando" | "error">("");
  const [prevStock, setPrevStock] = useState(item.stock);
  if (item.stock !== prevStock) {
    setPrevStock(item.stock);
    setValor(String(item.stock));
  }

  const guardar = async () => {
    const n = Number(valor);
    if (valor.trim() === "" || n === item.stock) return setValor(String(item.stock));
    if (!Number.isInteger(n) || n < 0) {
      setEstado("error");
      return;
    }
    setEstado("guardando");
    try {
      const r = await updateStock(item.id, n);
      setEstado("");
      onSaved(n, r.antes <= 0 && n > 0 ? `${item.name} volvió a tener stock: se avisó por correo a quien lo esperaba.` : null);
    } catch {
      setEstado("error");
    }
  };

  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={valor}
      aria-label={`Stock de ${item.name}`}
      aria-invalid={estado === "error"}
      disabled={estado === "guardando"}
      onChange={(e) => {
        setValor(e.target.value);
        setEstado("");
      }}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValor(String(item.stock));
      }}
      className={clsx(
        "h-9 w-20 rounded-md border bg-primary-black px-2 text-right text-sm font-semibold tabular-nums text-primary-champagne focus:outline-none focus:ring-2 focus:ring-primary-gold",
        estado === "error" ? "border-status-error" : "border-white/15",
        estado === "guardando" && "opacity-60"
      )}
    />
  );
}

export default function AdminInventoryPage() {
  const [params, setParams] = useSearchParams();
  const filtros = {
    q: params.get("q") ?? "",
    stock: (params.get("stock") ?? "") as StockFilter,
    category: params.get("category") ?? "",
    brand: params.get("brand") ?? "",
    sort: (params.get("sort") ?? "nombre") as InventorySort,
    page: Math.max(1, Number(params.get("page")) || 1),
    pageSize: Number(params.get("pageSize")) || 25,
  };
  const clave = params.toString();

  const [data, setData] = useState<{ clave: string; page?: InventoryPage; error?: string } | null>(null);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [texto, setTexto] = useState(filtros.q);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetchCategories().then(setCategorias).catch(() => setCategorias([]));
    fetchBrands().then(setMarcas).catch(() => setMarcas([]));
    return () => clearTimeout(espera.current);
  }, []);

  useEffect(() => {
    let vivo = true;
    const p = new URLSearchParams(clave);
    fetchInventory({
      q: p.get("q") ?? "",
      stock: (p.get("stock") ?? "") as StockFilter,
      category: p.get("category") ?? "",
      brand: p.get("brand") ?? "",
      sort: (p.get("sort") ?? "nombre") as InventorySort,
      page: Math.max(1, Number(p.get("page")) || 1),
      pageSize: Number(p.get("pageSize")) || 25,
    })
      .then((page) => vivo && setData({ clave, page }))
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

  const buscar = (v: string) => {
    setTexto(v);
    clearTimeout(espera.current);
    espera.current = setTimeout(() => cambiar({ q: v.trim() }), 300);
  };

  const pagina = data?.clave === clave ? data.page : undefined;
  const cargando = data?.clave !== clave;
  const error = data?.clave === clave ? data.error : undefined;
  const totalPaginas = pagina ? Math.max(1, Math.ceil(pagina.total / pagina.pageSize)) : 1;
  const desde = pagina && pagina.total ? (pagina.page - 1) * pagina.pageSize + 1 : 0;
  const hasta = pagina ? Math.min(pagina.page * pagina.pageSize, pagina.total) : 0;
  const hayFiltros = Boolean(filtros.q || filtros.category || filtros.brand);

  const alGuardar = (id: string) => (stock: number, mensaje: string | null) => {
    setData((d) =>
      d?.page ? { ...d, page: { ...d.page, items: d.page.items.map((i) => (i.id === id ? { ...i, stock } : i)) } } : d
    );
    if (mensaje) setAviso(mensaje);
    // los contadores de las pestañas y del menú cambian
    setRecarga((n) => n + 1);
  };

  const borrar = async (item: InventoryItem) => {
    if (!window.confirm(`¿Eliminar "${item.name}"? Deja de verse en la tienda y no se puede deshacer.`)) return;
    try {
      await deleteProduct(item.id);
      setAviso(`Se eliminó ${item.name}.`);
      setRecarga((n) => n + 1);
    } catch {
      setAviso(`No se pudo eliminar ${item.name}. Si tiene pedidos, cambia su stock a 0 en vez de borrarlo.`);
    }
  };

  return (
    <AdminLayout title="Inventario">
      <PageMeta title="Inventario" noindex />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-primary-champagne/60">
            {pagina ? `${pagina.counts.todos} perfumes${hayFiltros ? " con estos filtros" : ""}` : "Cargando…"}
          </p>
          <div className="flex gap-2">
            <Link to="/admin/importar" className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5">
              <Upload size={16} aria-hidden /> Importar CSV
            </Link>
            <Link to="/admin/nuevo" className="flex items-center gap-2 rounded-lg bg-primary-gold px-4 py-2 text-sm font-semibold text-primary-black hover:opacity-90">
              <PackagePlus size={16} aria-hidden /> Nuevo perfume
            </Link>
          </div>
        </div>

        {/* pestañas por stock */}
        <div role="tablist" aria-label="Filtrar por stock" className="flex gap-1 overflow-x-auto border-b border-white/10">
          {PESTAÑAS.map((t) => {
            const activa = filtros.stock === t.valor;
            return (
              <button
                key={t.label}
                role="tab"
                aria-selected={activa}
                onClick={() => cambiar({ stock: t.valor })}
                className={clsx(
                  "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                  activa ? t.activa : "border-transparent text-primary-champagne/60 hover:text-primary-champagne"
                )}
              >
                {t.label}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">{pagina ? pagina.counts[t.clave] : "…"}</span>
              </button>
            );
          })}
        </div>

        {/* filtros */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,2fr)_1fr_1fr_1fr_auto]">
          <label className="relative">
            <span className="sr-only">Buscar perfume</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-champagne/50" />
            <input
              type="search"
              value={texto}
              onChange={(e) => buscar(e.target.value)}
              placeholder="Buscar por nombre, marca o referencia"
              className={clsx(control, "w-full pl-9")}
            />
          </label>
          <select aria-label="Categoría" value={filtros.category} onChange={(e) => cambiar({ category: e.target.value })} className={control}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select aria-label="Marca" value={filtros.brand} onChange={(e) => cambiar({ brand: e.target.value })} className={control}>
            <option value="">Todas las marcas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select aria-label="Ordenar" value={filtros.sort} onChange={(e) => cambiar({ sort: e.target.value === "nombre" ? "" : e.target.value })} className={control}>
            {ORDENES.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
          </select>
          {hayFiltros && (
            <button
              type="button"
              onClick={() => {
                setTexto("");
                cambiar({ q: "", category: "", brand: "" });
              }}
              className="h-10 rounded-lg px-3 text-sm font-medium text-primary-gold hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {aviso && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-status-info/40 bg-status-info-bg px-4 py-3 text-sm">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso(null)} className="font-semibold text-primary-gold" aria-label="Cerrar aviso">×</button>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-status-error-bg px-4 py-3 text-sm text-status-error">{error}</p>}

        <section aria-label="Perfumes" aria-busy={cargando} className={clsx("glass-card !rounded-xl overflow-hidden", cargando && "opacity-60")}>
          {pagina && pagina.items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-primary-champagne/60">Ningún perfume coincide con estos filtros.</p>
          ) : (
            <>
              {/* computadora: tabla */}
              <table className="hidden w-full text-sm md:table">
                <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-primary-champagne/55">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Perfume</th>
                    <th className="px-3 py-3 font-semibold">Categoría</th>
                    <th className="px-3 py-3 text-right font-semibold">Precio</th>
                    <th className="px-3 py-3 font-semibold">Estado</th>
                    <th className="px-3 py-3 text-right font-semibold">Stock</th>
                    <th className="px-5 py-3 text-right font-semibold"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(pagina?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <img src={item.image ?? "/assets/products/sin-imagen.svg"} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md bg-white object-contain" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{item.name}</p>
                            <p className="truncate text-xs text-primary-champagne/55">{item.brand ?? "Sin marca"} · {item.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-primary-champagne/75">{item.category ?? "Sin categoría"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatPrice(item.price)}</td>
                      <td className="px-3 py-2.5"><StockBadge stock={item.stock} lowStock={pagina?.lowStock ?? 3} /></td>
                      <td className="px-3 py-2.5 text-right"><StockEditor item={item} onSaved={alGuardar(item.id)} /></td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Link to={`/admin/editar/${item.id}`} aria-label={`Editar ${item.name}`} title="Editar" className="rounded-md p-2 text-primary-champagne/70 hover:bg-white/5 hover:text-primary-gold">
                            <Pencil size={16} />
                          </Link>
                          <button type="button" onClick={() => borrar(item)} aria-label={`Eliminar ${item.name}`} title="Eliminar" className="rounded-md p-2 text-primary-champagne/70 hover:bg-status-error-bg hover:text-status-error">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* celular: tarjetas */}
              <ul className="md:hidden">
                {(pagina?.items ?? []).map((item) => (
                  <li key={item.id} className="flex gap-3 border-b border-white/5 p-4 last:border-0">
                    <img src={item.image ?? "/assets/products/sin-imagen.svg"} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-md bg-white object-contain" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{item.name}</p>
                        <p className="text-xs text-primary-champagne/55">{item.brand ?? "Sin marca"} · {formatPrice(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StockBadge stock={item.stock} lowStock={pagina?.lowStock ?? 3} />
                        <span className="flex-1" />
                        <StockEditor item={item} onSaved={alGuardar(item.id)} />
                        <Link to={`/admin/editar/${item.id}`} aria-label={`Editar ${item.name}`} className="rounded-md p-2 hover:bg-white/5"><Pencil size={16} /></Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* paginación */}
        {pagina && pagina.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-primary-champagne/60 tabular-nums">{desde} a {hasta} de {pagina.total}</span>
            <div className="flex items-center gap-2">
              <select aria-label="Perfumes por página" value={filtros.pageSize} onChange={(e) => cambiar({ pageSize: e.target.value === "25" ? "" : e.target.value })} className={clsx(control, "h-9")}>
                {[25, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
              </select>
              <button type="button" disabled={pagina.page <= 1} onClick={() => cambiar({ page: String(pagina.page - 1) })} aria-label="Página anterior" className="rounded-lg border border-white/15 p-2 disabled:opacity-40 hover:bg-white/5">
                <ChevronLeft size={16} />
              </button>
              <span className="tabular-nums">{pagina.page} / {totalPaginas}</span>
              <button type="button" disabled={pagina.page >= totalPaginas} onClick={() => cambiar({ page: String(pagina.page + 1) })} aria-label="Página siguiente" className="rounded-lg border border-white/15 p-2 disabled:opacity-40 hover:bg-white/5">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
