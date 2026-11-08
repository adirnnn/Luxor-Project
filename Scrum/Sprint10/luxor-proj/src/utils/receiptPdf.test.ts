// Comprobante del pedido en PDF
import { buildReceiptPdf, paymentText, receiptFilename, type ReceiptData } from "./receiptPdf";

const receipt: ReceiptData = {
  orderId: 42,
  createdAt: "2026-10-28T15:30:00Z",
  status: "Pagado",
  customer: "Ana Lopez",
  items: [
    { name: "Lattafa Khamrah", quantity: 2, unitPrice: 390, subtotal: 780 },
    { name: "Armaf Club de Nuit", quantity: 1, unitPrice: 450, subtotal: 450 },
  ],
  discount: 50,
  discountLabel: "BIENVENIDA",
  shipping: 0,
  delivery: { method: "recoger", store: { id: "luxor", name: "Joyeria Luxor", address: "C.C. San Isidro, Zona 16" } },
  total: 1180,
  payment: { brand: "VISA", last4: "4242" },
};

describe("receiptPdf", () => {
  it("el archivo lleva el número de pedido", () => {
    expect(receiptFilename(42)).toBe("comprobante-pedido-42.pdf");
  });

  it("muestra la tarjeta sin el símbolo que la fuente del PDF no tiene", () => {
    expect(paymentText({ brand: "VISA", last4: "4242" })).toBe("VISA **** 4242");
    expect(paymentText({ brand: null, last4: null })).toBe("Tarjeta");
    expect(paymentText(null)).toBe("Sin comprobante de pago disponible");
  });

  it("el PDF trae pedido, productos, descuento, entrega y total", async () => {
    const doc = await buildReceiptPdf(receipt);
    const pdf = doc.output();

    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("Victoria)");
    expect(pdf).not.toContain("(LUXOR)");
    expect(pdf).toContain("(#42)");
    expect(pdf).toContain("(Lattafa Khamrah)");
    expect(pdf).toContain("(Armaf Club de Nuit)");
    expect(pdf).toContain("(Q780.00)");
    expect(pdf).toContain("(Descuento \\(BIENVENIDA\\))");
    expect(pdf).toContain("(-Q50.00)");
    expect(pdf).toContain("(Gratis)");
    expect(pdf).toContain("(Q1,180.00)");
    expect(pdf).toContain("(VISA **** 4242)");
    expect(pdf).toContain("Recoger en Joyeria Luxor");
  });

  it("un pedido largo pasa a otra página", async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      name: `Perfume ${i + 1}`,
      quantity: 1,
      unitPrice: 100,
      subtotal: 100,
    }));
    const doc = await buildReceiptPdf({ ...receipt, items, total: 4000 });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
