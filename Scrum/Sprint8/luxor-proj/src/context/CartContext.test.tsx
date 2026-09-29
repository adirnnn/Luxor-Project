import { useEffect } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { CartProvider, useCart, type AddToCartResult } from "./CartContext";
import { maxQuantityFor, MAX_QTY_PER_ITEM } from "./cartLimits";
import type { Product } from "../services/productService";

const producto = (id: string, stock?: number): Product => ({
  id,
  name: `Perfume ${id}`,
  price: 100,
  image: "/images/x.png",
  description: "",
  stock,
  notes: { salida: "", corazon: "", fondo: "" },
});

// Catálogo que "devuelve la API": incluye un producto que NO está en src/data/products.ts.
const CATALOGO = [producto("nuevo-de-la-bd", 4), producto("khamrah", 3)];

let api: ReturnType<typeof useCart>;
const capturar = (valor: ReturnType<typeof useCart>) => { api = valor; };

function Espia({ onCart }: { onCart: typeof capturar }) {
  const cart = useCart();
  useEffect(() => onCart(cart));
  return <ul>{cart.cart.map((i) => <li key={i.product.id}>{i.product.id}:{i.quantity}</li>)}</ul>;
}

const montar = () =>
  render(
    <AuthProvider>
      <CartProvider>
        <Espia onCart={capturar} />
      </CartProvider>
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(CATALOGO), { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("maxQuantityFor", () => {
  it("usa el stock real con tope de 10", () => {
    expect(maxQuantityFor({ stock: 3 })).toBe(3);
    expect(maxQuantityFor({ stock: 50 })).toBe(MAX_QTY_PER_ITEM);
    expect(maxQuantityFor({ stock: 0 })).toBe(0);
    expect(maxQuantityFor({ stock: undefined })).toBe(MAX_QTY_PER_ITEM);
  });
});

describe("CartContext", () => {
  it("addToCart agrega la cantidad pedida de una vez", async () => {
    montar();
    let r!: AddToCartResult;
    act(() => { r = api.addToCart(producto("nuevo-de-la-bd", 4), 3); });
    expect(r).toMatchObject({ ok: true, added: 3 });
    expect(await screen.findByText("nuevo-de-la-bd:3")).toBeInTheDocument();
  });

  it("no pasa del stock y avisa en pantalla cuánto se agregó", async () => {
    montar();
    act(() => { api.addToCart(producto("khamrah", 3), 2); });
    let r!: AddToCartResult;
    act(() => { r = api.addToCart(producto("khamrah", 3), 2); });
    expect(r).toMatchObject({ ok: true, added: 1 });
    expect(await screen.findByText("khamrah:3")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/máximo disponible/);
  });

  it("con stock 0 no agrega nada y avisa que está agotado", async () => {
    montar();
    let r!: AddToCartResult;
    act(() => { r = api.addToCart(producto("agotado", 0), 1); });
    expect(r).toMatchObject({ ok: false, added: 0 });
    expect(screen.getByRole("status")).toHaveTextContent(/agotado/);
    expect(screen.queryByText(/agotado:/)).not.toBeInTheDocument();
  });

  it("nunca pasa del tope de 10 unidades aunque haya más stock", async () => {
    montar();
    act(() => { api.addToCart(producto("mucho-stock", 100), 25); });
    expect(await screen.findByText("mucho-stock:10")).toBeInTheDocument();
  });

  it("setQuantity ajusta la cantidad al rango permitido", async () => {
    montar();
    act(() => { api.addToCart(producto("khamrah", 3), 1); });
    act(() => { api.setQuantity("khamrah", 99); });
    expect(await screen.findByText("khamrah:3")).toBeInTheDocument();
    act(() => { api.setQuantity("khamrah", 0); });
    expect(await screen.findByText("khamrah:1")).toBeInTheDocument();
  });

  it("no usa alert()", async () => {
    const alerta = vi.spyOn(window, "alert").mockImplementation(() => {});
    montar();
    act(() => { api.addToCart(producto("agotado", 0), 1); });
    act(() => { api.addToCart(producto("khamrah", 3), 5); });
    expect(alerta).not.toHaveBeenCalled();
  });

  it("al recargar, un producto que solo existe en la BD sigue en el carrito, con datos de la API", async () => {
    localStorage.setItem(
      "luxor-cart",
      JSON.stringify([{ product: { ...producto("nuevo-de-la-bd"), price: 1, stock: undefined }, quantity: 2 }]),
    );
    montar();
    expect(await screen.findByText("nuevo-de-la-bd:2")).toBeInTheDocument();
    await waitFor(() => expect(api.cart[0].product.stock).toBe(4));
    expect(api.cart[0].product.price).toBe(100);
  });

  it("al recargar, quita del carrito los productos que ya no existen y avisa", async () => {
    localStorage.setItem(
      "luxor-cart",
      JSON.stringify([
        { product: producto("khamrah"), quantity: 1 },
        { product: producto("ya-no-existe"), quantity: 1 },
      ]),
    );
    montar();
    expect(await screen.findByText("khamrah:1")).toBeInTheDocument();
    expect(screen.queryByText(/ya-no-existe/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ya no están disponibles/);
  });
});
