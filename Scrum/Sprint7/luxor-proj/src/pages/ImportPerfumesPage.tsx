import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Section } from "../components/ui/Section";
import { Container } from "../components/ui/Container";
import { Button } from "../components/ui/Button";
import { H1, Text } from "../components/ui/Typography";
import { useAuth } from "../context/AuthContext";
import { downloadCsvTemplate, fetchImportHistory, importProducts, type ImportSummary } from "../services/importService";

export default function ImportPerfumesPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<ImportSummary[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    try { setLoading(true); setHistory(await fetchImportHistory()); }
    catch { setError("No se pudo cargar el historial de importaciones."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isAuthenticated && user?.role === "ADMIN") void loadHistory(); }, [isAuthenticated, user]);
  if (!isAuthenticated || user?.role !== "ADMIN") return <Navigate to="/" replace />;

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setSummary(null);
    setError(selected && !selected.name.toLowerCase().endsWith(".csv") ? "Selecciona un archivo con extensión .csv." : null);
    setFile(selected?.name.toLowerCase().endsWith(".csv") ? selected : null);
  };
  const submit = async () => {
    if (!file) return setError("Selecciona un archivo CSV antes de importar.");
    try {
      setImporting(true); setError(null);
      const result = await importProducts(file);
      setSummary(result); setFile(null);
      if (input.current) input.current.value = "";
      await loadHistory();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo importar el archivo."); }
    finally { setImporting(false); }
  };

  return <MainLayout><Section size="lg" className="min-h-screen pt-28 md:pt-32 pb-20"><Container>
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4"><div><H1 className="text-primary-gold font-light italic uppercase tracking-tighter">Importar perfumes</H1><Text className="text-primary-champagne/40 text-xs uppercase tracking-[.25em]">Carga masiva de inventario</Text></div><Button variant="outline" onClick={() => navigate("/admin")}>Volver</Button></div>
      <div className="glass-card p-6 md:p-8 rounded-[28px] flex flex-col gap-5 border-white/5">
        <div><p className="text-primary-champagne font-medium">1. Descarga y completa la plantilla CSV</p><p className="text-primary-champagne/50 text-sm mt-1">Columnas requeridas: id, name, price, image, description, stock, salida, corazon, fondo.</p></div>
        <div className="flex flex-col sm:flex-row gap-3"><Button variant="outline" onClick={() => void downloadCsvTemplate().catch(() => setError("No se pudo descargar la plantilla."))}>Descargar plantilla</Button><input ref={input} type="file" accept=".csv,text/csv" onChange={selectFile} className="block w-full text-sm text-primary-champagne/60 file:mr-4 file:border-0 file:rounded-full file:bg-primary-gold file:px-4 file:py-2 file:text-primary-black file:font-bold" /></div>
        {file && <Text className="text-primary-gold text-sm">Archivo seleccionado: {file.name}</Text>}
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">{error}</div>}
        <Button onClick={() => void submit()} disabled={!file || importing} className="sm:self-start">{importing ? "Importando..." : "Validar e importar"}</Button>
      </div>
      {summary && <div className="glass-card p-6 rounded-[28px] border-white/5"><h2 className="text-primary-gold text-xl">Resumen de importación</h2><div className="grid grid-cols-3 gap-4 mt-4 text-center"><div><b className="text-primary-champagne text-2xl">{summary.total_rows}</b><p className="text-xs text-primary-champagne/50">Leídas</p></div><div><b className="text-green-300 text-2xl">{summary.imported_rows}</b><p className="text-xs text-primary-champagne/50">Importadas</p></div><div><b className="text-red-300 text-2xl">{summary.rejected_rows}</b><p className="text-xs text-primary-champagne/50">Rechazadas</p></div></div>{summary.errors.length > 0 && <ul className="mt-5 space-y-2 text-sm text-red-200">{summary.errors.map((item, index) => <li key={`${item.row}-${item.field}-${index}`}>Fila {item.row}, {item.field}: {item.message}</li>)}</ul>}</div>}
      <div className="glass-card p-6 rounded-[28px] border-white/5"><h2 className="text-primary-gold text-xl mb-4">Historial de importaciones</h2>{loading ? <Text>Cargando historial...</Text> : history.length === 0 ? <Text className="text-primary-champagne/50">Aún no hay importaciones registradas.</Text> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-primary-champagne/50"><tr><th className="pb-3">Archivo</th><th>Fecha</th><th>Importadas</th><th>Rechazadas</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-t border-white/5 text-primary-champagne"><td className="py-3">{item.file_name}</td><td>{new Date(item.created_at).toLocaleString()}</td><td className="text-green-300">{item.imported_rows}/{item.total_rows}</td><td className="text-red-300">{item.rejected_rows}</td></tr>)}</tbody></table></div>}</div>
    </div>
  </Container></Section></MainLayout>;
}
