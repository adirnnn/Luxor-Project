// SFTWRKEY-455: eventos de Vercel Web Analytics (sin cookies). Solo se mandan datos del
// catálogo y del monto; nunca nombre, correo, dirección ni datos de tarjeta.
import { track } from "@vercel/analytics";

type EventData = Record<string, string | number>;

function safeTrack(name: string, data?: EventData) {
  try {
    track(name, data);
  } catch {
    // la analítica nunca debe romper la tienda
  }
}

export const trackViewProduct = (id: string, name: string) => safeTrack("ver_perfume", { id, name });

export const trackAddToCart = (id: string, name: string, quantity: number) =>
  safeTrack("agregar_al_carrito", { id, name, cantidad: quantity });

export const trackPurchase = (total: number, items: number) =>
  safeTrack("compra_completada", { total, productos: items });
