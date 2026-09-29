import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Product } from "../services/productService";
import { fetchProducts } from "../services/productService";
import { useAuth } from "./AuthContext";
import { authHeaders } from "../services/apiClient";
import { maxQuantityFor } from "./cartLimits";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface AddToCartResult {
  ok: boolean;
  added: number;
  message: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => AddToCartResult;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  totalItems: number;
  totalPrice: number;
  clearCart: () => void;
}

type CartApiItem = { product_id: string; quantity: number };

const CartContext = createContext<CartContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  const showNotice = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Cargar carrito (backend si hay usuario, si no localStorage) y completarlo con los
  // datos reales de la API: así aparecen los productos nuevos de la BD con su stock y precio.
  useEffect(() => {
    const loadCart = async () => {
      const numericUserId = user ? Number(user.id) : NaN;
      let items: CartApiItem[] = [];
      let saved: CartItem[] = [];

      if (user && !isNaN(numericUserId)) {
        try {
          const res = await fetch(`${API_URL}/cart/${numericUserId}`, { headers: authHeaders() });
          if (res.ok) items = await res.json();
        } catch (err) {
          console.error("Error loading cart from backend", err);
        }
      } else {
        try {
          saved = JSON.parse(localStorage.getItem("luxor-cart") || "[]");
          items = saved.map((item) => ({ product_id: item.product.id, quantity: item.quantity }));
        } catch {
          saved = [];
        }
      }

      if (items.length > 0) {
        try {
          const catalog = new Map((await fetchProducts()).map((p) => [p.id, p]));
          const populated = items
            .map((item) => {
              const product = catalog.get(item.product_id);
              return product ? { product, quantity: item.quantity } : null;
            })
            .filter((item): item is CartItem => item !== null);
          if (populated.length < items.length) {
            showNotice("Algunos productos de tu carrito ya no están disponibles y se quitaron.");
          }
          setCart(populated);
        } catch (err) {
          // Sin API se mantiene lo guardado localmente (los productos del backend no se pueden mostrar).
          console.error("Error loading products for the cart", err);
          setCart(saved);
        }
      } else {
        setCart([]);
      }
      setIsLoaded(true);
    };

    setIsLoaded(false);
    loadCart();
  }, [user, showNotice]);

  // Guardar carrito (Backend si hay usuario y es numérico, sino LocalStorage)
  useEffect(() => {
    if (!isLoaded) return;

    const numericUserId = user ? Number(user.id) : NaN;

    if (user && !isNaN(numericUserId)) {
      const saveCart = async () => {
        try {
          const payload = cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity
          }));
          await fetch(`${API_URL}/cart/${numericUserId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload)
          });
        } catch (err) {
          console.error("Error saving cart to backend", err);
        }
      };
      saveCart();
    } else {
      localStorage.setItem("luxor-cart", JSON.stringify(cart));
    }
  }, [cart, user, isLoaded]);

  const addToCart = (product: Product, quantity = 1): AddToCartResult => {
    const max = maxQuantityFor(product);
    const current = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
    const wanted = Math.max(1, Math.floor(quantity));
    const next = Math.min(current + wanted, max);
    const added = next - current;

    let result: AddToCartResult;
    if (max === 0) {
      result = { ok: false, added: 0, message: `${product.name} está agotado.` };
    } else if (added <= 0) {
      result = { ok: false, added: 0, message: `Ya tienes el máximo disponible de ${product.name} (${max}).` };
    } else if (added < wanted) {
      result = { ok: true, added, message: `Se agregaron ${added} de ${wanted}: es el máximo disponible de ${product.name} (${max}).` };
    } else {
      result = { ok: true, added, message: `Agregaste ${added} ${added === 1 ? "unidad" : "unidades"} de ${product.name} al carrito.` };
    }

    if (added > 0) {
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (!existing) return [...prev, { product, quantity: Math.min(wanted, max) }];
        return prev.map((item) =>
          item.product.id === product.id ? { product, quantity: Math.min(item.quantity + wanted, max) } : item
        );
      });
    }
    showNotice(result.message);
    return result;
  };

  const setQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const max = Math.max(1, maxQuantityFor(item.product));
        return { ...item, quantity: Math.min(Math.max(1, Math.floor(quantity)), max) };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const incrementQuantity = (productId: string) => {
    const item = cart.find((i) => i.product.id === productId);
    if (item) setQuantity(productId, item.quantity + 1);
  };

  const decrementQuantity = (productId: string) => {
    const item = cart.find((i) => i.product.id === productId);
    if (item) setQuantity(productId, item.quantity - 1);
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (Number(item.product.price) || 0) * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, setQuantity, removeFromCart, incrementQuantity, decrementQuantity, clearCart, totalItems, totalPrice }}>
      {children}
      {notice && (
        <div
          key={notice.id}
          role="status"
          className="fixed bottom-24 left-1/2 z-[120] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-primary-gold/30 bg-primary-black/95 px-5 py-3 text-center text-sm font-bold text-primary-champagne shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        >
          {notice.text}
        </div>
      )}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    return {
      cart: [],
      addToCart: (): AddToCartResult => ({ ok: false, added: 0, message: "" }),
      setQuantity: () => {},
      removeFromCart: () => {},
      incrementQuantity: () => {},
      decrementQuantity: () => {},
      clearCart: () => {},
      totalItems: 0,
      totalPrice: 0,
    };
  }
  return context;
};
