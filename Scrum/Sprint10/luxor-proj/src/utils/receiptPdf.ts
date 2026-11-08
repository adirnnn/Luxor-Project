import type { jsPDF } from "jspdf";
import { formatPrice } from "./formatPrice";
import { describeDelivery, shippingLabel, type Delivery } from "./shipping";
import { SITE_NAME } from "../seo/site";

// Comprobante del pedido en PDF. Lo usan la confirmación con cuenta y el comprobante del invitado.
// jspdf se carga solo cuando el cliente pide el PDF, para no hacer más pesada la página.

export type ReceiptData = {
  orderId: number | string;
  createdAt?: string | null;
  status?: string | null;
  customer?: string | null;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  discount?: number | null;
  discountLabel?: string | null;
  shipping: number;
  delivery?: Delivery | null;
  total: number;
  payment?: { brand: string | null; last4: string | null } | null;
};

const GOLD: [number, number, number] = [197, 160, 89];
const DARK: [number, number, number] = [42, 22, 16];
const MUTED: [number, number, number] = [110, 100, 95];
const LINE: [number, number, number] = [220, 210, 200];

const MARGIN = 20;
const PAGE_W = 210;
const RIGHT = PAGE_W - MARGIN;
const BOTTOM = 277;

// la fuente estándar del PDF no trae algunos símbolos (−, •, espacios finos de la hora)
const clean = (text: string) =>
  text
    .replace(/[\u202F\u00A0]/g, " ")
    .replace(/\u2212/g, "-")
    .replace(/\u2022/g, "*");

export const receiptFilename = (orderId: number | string) => `comprobante-pedido-${orderId}.pdf`;

export function formatReceiptDate(iso: string) {
  return new Date(iso).toLocaleString("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function paymentText(payment: ReceiptData["payment"]) {
  if (!payment) return "Sin comprobante de pago disponible";
  return `${payment.brand || "Tarjeta"}${payment.last4 ? ` **** ${payment.last4}` : ""}`;
}

export async function buildReceiptPdf(data: ReceiptData): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const text = (value: string, x: number, options?: { align?: "left" | "right" | "center" }) =>
    doc.text(clean(value), x, y, options);

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...GOLD);
  y += 6;
  text(SITE_NAME, MARGIN);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  text("Comprobante de compra", RIGHT, { align: "right" });
  y += 5;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, RIGHT, y);
  y += 12;

  // datos del pedido en dos columnas
  const fields: [string, string][] = [["Número de pedido", `#${data.orderId}`]];
  if (data.createdAt) fields.push(["Fecha de compra", formatReceiptDate(data.createdAt)]);
  if (data.status) fields.push(["Estado", data.status]);
  fields.push(["Método de pago", paymentText(data.payment)]);
  if (data.customer) fields.push(["Cliente", data.customer]);

  for (let i = 0; i < fields.length; i += 2) {
    [fields[i], fields[i + 1]].forEach((field, col) => {
      if (!field) return;
      const x = MARGIN + col * 90;
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(clean(field[0]), x, y);
      doc.setFontSize(11);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.text(clean(field[1]), x, y + 6);
      doc.setFont("helvetica", "normal");
    });
    y += 15;
  }
  y += 3;

  // tabla de productos
  const COL_QTY = 128;
  const COL_UNIT = 158;
  const drawHeader = () => {
    doc.setFillColor(247, 244, 239);
    doc.rect(MARGIN, y - 5, RIGHT - MARGIN, 8, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    text("Producto", MARGIN + 2);
    text("Cant.", COL_QTY, { align: "right" });
    text("P. unitario", COL_UNIT, { align: "right" });
    text("Subtotal", RIGHT - 2, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 9;
  };
  drawHeader();

  doc.setFontSize(10);
  for (const item of data.items) {
    const lines: string[] = doc.splitTextToSize(clean(item.name), COL_QTY - MARGIN - 20);
    const height = lines.length * 5 + 3;
    if (y + height > BOTTOM) {
      doc.addPage();
      y = MARGIN + 5;
      drawHeader();
      doc.setFontSize(10);
    }
    doc.setTextColor(...DARK);
    doc.text(lines, MARGIN + 2, y);
    text(String(item.quantity), COL_QTY, { align: "right" });
    text(formatPrice(item.unitPrice), COL_UNIT, { align: "right" });
    text(formatPrice(item.subtotal), RIGHT - 2, { align: "right" });
    y += height;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y - 3, RIGHT, y - 3);
    y += 2;
  }

  // totales
  ensureSpace(40);
  y += 3;
  const row = (label: string, value: string) => {
    doc.setTextColor(...MUTED);
    text(label, COL_UNIT - 40);
    doc.setTextColor(...DARK);
    text(value, RIGHT - 2, { align: "right" });
    y += 6;
  };
  doc.setFontSize(10);
  if ((data.discount ?? 0) > 0) {
    row(`Descuento${data.discountLabel ? ` (${data.discountLabel})` : ""}`, `-${formatPrice(data.discount ?? 0)}`);
  }
  row(data.delivery?.method === "recoger" ? "Recoger en tienda" : "Envío", shippingLabel(data.shipping));

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(COL_UNIT - 40, y - 2, RIGHT, y - 2);
  y += 5;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  text("Total", COL_UNIT - 40);
  doc.setTextColor(...GOLD);
  text(formatPrice(data.total), RIGHT - 2, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 12;

  // entrega y nota final
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const delivery = describeDelivery(data.delivery);
  if (delivery) {
    const lines: string[] = doc.splitTextToSize(clean(delivery), RIGHT - MARGIN);
    ensureSpace(lines.length * 5);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5 + 3;
  }
  ensureSpace(10);
  const note: string[] = doc.splitTextToSize(
    "Guarda tu número de pedido. Con él puedes consultar el estado de tu compra en Mis compras, con el asistente o por WhatsApp.",
    RIGHT - MARGIN,
  );
  doc.text(note, MARGIN, y);

  return doc;
}

export async function downloadReceiptPdf(data: ReceiptData) {
  const doc = await buildReceiptPdf(data);
  doc.save(receiptFilename(data.orderId));
}
