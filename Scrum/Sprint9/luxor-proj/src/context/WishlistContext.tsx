import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { addToWishlist, fetchWishlist, removeFromWishlist } from "../services/wishlistService";

// SFTWRKEY-429: ids de los productos en la lista de deseos del usuario con sesión.

type WishlistContextType = {
  hasSession: boolean;
  ids: ReadonlySet<string>;
  isWished: (productId: string) => boolean;
  // false si no hay sesión (la pantalla manda al login) o si falló el cambio
  toggle: (productId: string) => Promise<boolean>;
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

type Loaded = { userId: number; ids: Set<string> };
const EMPTY: ReadonlySet<string> = new Set();

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    fetchWishlist(userId)
      .then((items) => { if (!cancelled) setLoaded({ userId, ids: new Set(items.map((p) => p.id)) }); })
      .catch(() => { if (!cancelled) setLoaded({ userId, ids: new Set() }); });
    return () => { cancelled = true; };
  }, [userId]);

  // los ids de otro usuario (o de una sesión ya cerrada) nunca se muestran
  const ids = userId !== null && loaded?.userId === userId ? loaded.ids : EMPTY;

  const toggle = useCallback(
    async (productId: string) => {
      if (userId === null) return false;
      const wished = ids.has(productId);
      const change = (add: boolean) =>
        setLoaded((prev) => {
          const next = new Set(prev?.userId === userId ? prev.ids : []);
          if (add) next.add(productId);
          else next.delete(productId);
          return { userId, ids: next };
        });

      change(!wished); // se actualiza al instante y se revierte si el servidor falla
      try {
        if (wished) await removeFromWishlist(userId, productId);
        else await addToWishlist(userId, productId);
        return true;
      } catch {
        change(wished);
        return false;
      }
    },
    [userId, ids]
  );

  const value = useMemo<WishlistContextType>(
    () => ({ hasSession: userId !== null, ids, isWished: (productId) => ids.has(productId), toggle }),
    [userId, ids, toggle]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

// Fuera del provider (por ejemplo en pruebas aisladas) se comporta como "sin sesión".
// eslint-disable-next-line react-refresh/only-export-components -- el hook se exporta junto al provider por diseño
export const useWishlist = (): WishlistContextType => {
  const ctx = useContext(WishlistContext);
  return ctx ?? { hasSession: false, ids: EMPTY, isWished: () => false, toggle: async () => false };
};
