const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export type ImportError = { row: number; field: string; message: string };
export type ImportSummary = {
  id: number;
  file_name: string;
  total_rows: number;
  imported_rows: number;
  rejected_rows: number;
  errors: ImportError[];
  created_at: string;
};

export async function downloadCsvTemplate() {
  const response = await fetch(`${API_URL}/imports/products/template`);
  if (!response.ok) throw new Error("No se pudo descargar la plantilla.");
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "plantilla-perfumes.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importProducts(file: File): Promise<ImportSummary> {
  const csv = await file.text();
  const response = await fetch(`${API_URL}/imports/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, csv }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo importar el archivo.");
  return data.summary;
}

export async function fetchImportHistory(): Promise<ImportSummary[]> {
  const response = await fetch(`${API_URL}/imports/products`);
  if (!response.ok) throw new Error("No se pudo cargar el historial.");
  const data = await response.json();
  return data.imports;
}
