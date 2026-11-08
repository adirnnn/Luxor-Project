import { useState } from "react";
import { Download, Printer } from "lucide-react";
import clsx from "clsx";
import { downloadReceiptPdf, type ReceiptData } from "../../utils/receiptPdf";

type Props = {
  receipt: ReceiptData;
  className?: string;
  // en Mi cuenta se imprimiría toda la página, así que ahí solo va la descarga
  printable?: boolean;
};

const buttonStyle =
  "inline-flex items-center justify-center gap-2 rounded-button px-6 py-4 " +
  "text-xs font-black uppercase tracking-widest transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-gold " +
  "disabled:cursor-wait disabled:opacity-60";

// Botones del comprobante: descargar en PDF o imprimir. No salen en la hoja impresa.
export function ReceiptActions({ receipt, className, printable = true }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    setDownloading(true);
    setError("");
    try {
      await downloadReceiptPdf(receipt);
    } catch {
      setError("No se pudo generar el PDF. Intenta de nuevo o usa Imprimir.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={clsx("print:hidden", className)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className={`${buttonStyle} border border-primary-gold text-primary-gold hover:bg-primary-gold hover:text-primary-black`}
        >
          <Download size={16} aria-hidden="true" />
          {downloading ? "Generando PDF…" : "Descargar PDF"}
        </button>

        {printable && (
        <button
          type="button"
          onClick={() => window.print()}
          className={`${buttonStyle} border border-white/20 text-primary-champagne hover:bg-white/10`}
        >
          <Printer size={16} aria-hidden="true" />
          Imprimir
        </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-status-error">
          {error}
        </p>
      )}
    </div>
  );
}
