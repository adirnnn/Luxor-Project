import type { PickupStore } from "../../utils/shipping";

// Feedback del cliente: mapa de cada local. Se usa el mapa de Google sin llave de API
// (búsqueda por nombre y dirección); vercel.json permite www.google.com en frame-src.
const consulta = (store: PickupStore) => encodeURIComponent(`${store.name}, ${store.address}, Guatemala`);

const mapsUrl = (store: PickupStore) => `https://www.google.com/maps/search/?api=1&query=${consulta(store)}`;

type StoreMapProps = { store: PickupStore; compact?: boolean };

export function StoreMap({ store, compact = false }: StoreMapProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <p className="font-bold text-primary-champagne">{store.name}</p>
        <p className="text-sm text-primary-champagne/60">{store.address}</p>
        {store.hours && <p className="text-sm text-primary-gold">{store.hours}</p>}
      </div>
      <iframe
        title={`Mapa de ${store.name}`}
        src={`https://www.google.com/maps?q=${consulta(store)}&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={`w-full rounded-xl border-0 ${compact ? "h-40" : "h-56"}`}
      />
      <a
        href={mapsUrl(store)}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-xs font-bold uppercase tracking-[0.2em] text-primary-gold underline-offset-4 hover:underline"
      >
        Abrir en Google Maps
      </a>
    </div>
  );
}

export function StoreLocations({ stores }: { stores: PickupStore[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {stores.map((store) => (
        <StoreMap key={store.id} store={store} compact />
      ))}
    </div>
  );
}
