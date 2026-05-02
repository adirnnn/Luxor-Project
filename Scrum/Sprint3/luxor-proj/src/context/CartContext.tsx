import React, { createContext, useContext, useState, useEffect } from "react";
import type { Product } from "../data/products";
import { products as localProducts } from "../data/products";
import { useAuth } from "./AuthContext";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  totalItems: number;
  totalPrice: number;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cargar carrito (Backend si hay usuario y es numérico, sino LocalStorage)
  useEffect(() => {
    const loadCart = async () => {
      const numericUserId = user ? Number(user.id) : NaN;

      if (user && !isNaN(numericUserId)) {
        try {
          const res = await fetch(`http://localhost:3000/cart/${numericUserId}`);
          if (res.ok) {
            const items = await res.json();
            const populatedCart = items.map((item: any) => {
              const product = localProducts.find(p => p.id === item.product_id);
              return product ? { product, quantity: item.quantity } : null;
            }).filter(Boolean);
            setCart(populatedCart);
          }
        } catch (err) {
          console.error("Error loading cart from backend", err);
        }
      } else if (!user || isNaN(numericUserId)) {
        try {
          const saved = localStorage.getItem("luxor-cart");
          if (saved) setCart(JSON.parse(saved));
        } catch (e) {
          setCart([]);
        }
      }
      setIsLoaded(true);
    };
    
    setIsLoaded(false);
    loadCart();
  }, [user]);

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
          await fetch(`http://localhost:3000/cart/${numericUserId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (err) {
          console.error("Error saving cart to backend", err);
        }
      };
      saveCart();
    } else if (!user || isNaN(numericUserId)) {
      localStorage.setItem("luxor-cart", JSON.stringify(cart));
    }
  }, [cart, user, isLoaded]);

  const addToCart = (product: Product) => {
    // Buscar el producto real en los datos locales para tener el stock actualizado
    const realProduct = localProducts.find(p => p.id === product.id) || product;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === realProduct.id);
      if (existing) {
        if (realProduct.stock !== undefined && existing.quantity >= realProduct.stock) {
          alert(`No hay más stock disponible para ${realProduct.name} (Máximo: ${realProduct.stock})`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === realProduct.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      if (realProduct.stock !== undefined && realProduct.stock < 1) {
        alert(`No hay stock disponible para ${realProduct.name}`);
        return prev;
      }
      return [...prev, { product: realProduct, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const incrementQuantity = (productId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const realProduct = localProducts.find(p => p.id === productId) || item.product;
          if (realProduct.stock !== undefined && item.quantity >= realProduct.stock) {
             alert(`No hay más stock disponible para ${realProduct.name} (Máximo: ${realProduct.stock})`);
             return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
  };

  const decrementQuantity = (productId: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, incrementQuantity, decrementQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    return {
      cart: [],
      addToCart: () => {},
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
