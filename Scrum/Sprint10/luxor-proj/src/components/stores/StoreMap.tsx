import type { PickupStore } from "../../utils/shipping";

// Feedback del cliente: mapa de Waze con el pin exacto de cada local. La búsqueda por dirección
// no caía en el lugar correcto, así que cada local lleva sus coordenadas tomadas del pin.
// Las coordenadas salen de los enlaces de Waze que compartió la tienda. Si se agrega un local sin
// coordenadas, se muestran solo su dirección y su horario. vercel.json permite embed.waze.com en frame-src.
type Pin = { lat: number; lon: number };

const STORE_PINS: Record<string, Pin | undefined> = {
  victoria: { lat: 14.630721, lon: -90.518181 }, // Metro Centro
  glamour: { lat: 14.630163, lon: -90.51861 }, // C.C. El Pueblito
  luxor: { lat: 14.607718, lon: -90.469902 }, // C.C. San Isidro
};

const wazeEmbed = ({ lat, lon }: Pin) => `https://embed.waze.com/iframe?zoom=17&lat=${lat}&lon=${lon}&pin=1`;

const wazeLink = ({ lat, lon }: Pin) => `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;

export function StoreMap({ store }: { store: PickupStore }) {
  const pin = STORE_PINS[store.id];
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <p className="font-bold text-primary-champagne">{store.name}</p>
        <p className="text-sm text-primary-champagne/60">{store.address}</p>
        {store.hours && <p className="text-sm text-primary-gold">{store.hours}</p>}
      </div>
      {pin && (
        <>
          <iframe
            title={`Mapa de ${store.name}`}
            src={wazeEmbed(pin)}
            loading="lazy"
            className="h-48 w-full rounded-xl border-0"
          />
          <a
            href={wazeLink(pin)}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-xs font-bold uppercase tracking-[0.2em] text-primary-gold underline-offset-4 hover:underline"
          >
            Cómo llegar con Waze
          </a>
        </>
      )}
    </div>
  );
}

export function StoreLocations({ stores }: { stores: PickupStore[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {stores.map((store) => (
        <StoreMap key={store.id} store={store} />
      ))}
    </div>
  );
}
