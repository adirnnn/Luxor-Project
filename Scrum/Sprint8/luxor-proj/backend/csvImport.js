export const CSV_COLUMNS = [
  "id", "name", "price", "image", "description", "stock", "salida", "corazon", "fondo",
];

export const CSV_TEMPLATE = `${CSV_COLUMNS.join(",")}\n` +
  "noir-oud,Noir Oud,425.00,/assets/products/noir-oud.png,Fragancia amaderada,12,Bergamota,Rosa,Oud\n";

/** Parses RFC-4180-style CSV, including quoted commas, quotes and new lines. */
export function parseCsv(source) {
  if (typeof source !== "string" || !source.trim()) throw new Error("El archivo CSV está vacío.");
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') {
      if (field) throw new Error("Comillas inválidas en el CSV.");
      quoted = true;
    } else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = []; field = "";
    } else field += character;
  }
  if (quoted) throw new Error("Falta cerrar una comilla en el CSV.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function validateCsv(source) {
  const rows = parseCsv(source);
  if (!rows.length) throw new Error("El archivo CSV no contiene encabezados.");
  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, "").toLowerCase());
  const expected = CSV_COLUMNS.join(", ");
  if (headers.length !== CSV_COLUMNS.length || headers.some((header, index) => header !== CSV_COLUMNS[index])) {
    throw new Error(`Encabezados inválidos. Se espera exactamente: ${expected}.`);
  }
  const ids = new Set();
  const products = [], errors = [];
  rows.slice(1).forEach((cells, offset) => {
    const row = offset + 2;
    if (cells.length !== CSV_COLUMNS.length) {
      errors.push({ row, field: "estructura", message: `Se esperaban ${CSV_COLUMNS.length} columnas y se recibieron ${cells.length}.` });
      return;
    }
    const value = Object.fromEntries(CSV_COLUMNS.map((column, index) => [column, cells[index].trim()]));
    const addError = (field, message) => errors.push({ row, field, message });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value.id)) addError("id", "Debe usar letras, números y guiones.");
    else if (ids.has(value.id.toLowerCase())) addError("id", "El identificador está duplicado en el archivo.");
    else ids.add(value.id.toLowerCase());
    if (!value.name || value.name.length > 200) addError("name", "Es obligatorio y debe tener hasta 200 caracteres.");
    if (!/^\d+(?:\.\d{1,2})?$/.test(value.price) || Number(value.price) < 0) addError("price", "Debe ser un precio numérico no negativo con hasta dos decimales.");
    if (!/^\d+$/.test(value.stock) || Number(value.stock) < 0) addError("stock", "Debe ser un número entero no negativo.");
    if (value.image.length > 500) addError("image", "No puede superar 500 caracteres.");
    if (value.description.length > 5000) addError("description", "No puede superar 5000 caracteres.");
    ["salida", "corazon", "fondo"].forEach((field) => { if (value[field].length > 200) addError(field, "No puede superar 200 caracteres."); });
    products.push({ ...value, price: Number(value.price), stock: Number(value.stock), row });
  });
  if (!products.length) throw new Error("El archivo CSV no contiene registros.");
  return { products, errors, totalRows: products.length };
}
