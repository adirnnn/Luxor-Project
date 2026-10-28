// SFTWRKEY-432: cupones en el carrito, el pago y el panel
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../../context/AuthContext";
import { CartProvider } from "../../context/CartContext";
import { SearchProvider } from "../../context/SearchContext";
import CartPage from "../../pages/CartPage";
import AdminCouponsPage from "../../pages/AdminCouponsPage";
import { discountFor, readStoredCoupon, storeCoupon } from "./coupon";
import { startCheckout } from "../../services/checkoutService";
import { createCoupon, fetchAdminCoupons, setCouponActive, validateCoupon } from "../../services/couponService";
import type { AdminCoupon, PublicCoupon } from "../../services/couponService";

vi.mock("../../services/couponService", () => ({
  validateCoupon: vi.fn(),
  fetchAdminCoupons: vi.fn(),
  createCoupon: vi.fn(),
  setCouponActive: vi.fn(),
}));
const validar = vi.mocked(validateCoupon);
const listar = vi.mocked(fetchAdminCoupons);
const crear = vi.mocked(createCoupon);
const activar = vi.mocked(setCouponActive);

const VERANO: PublicCoupon = { code: "VERANO10", discount_type: "porcentaje", value: 10, min_purchase: 0 };

// carrito guardado de un invitado: 2 × Khamrah de Q260 (Q520)
const CARRITO = [
  { product: { id: "khamrah", name: "Lattafa Khamrah", price: 260, image: "/k.webp", description: "", stock: 10, notes: { salida: "", corazon: "", fondo: "" } }, quantity: 2 },
];

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  validar.mockReset();
  listar.mockReset();
  crear.mockReset();
  activar.mockReset();
  // el carrito refresca los precios con GET /products; GET /shipping y el resto responden vacío
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/products")
      ? new Response(JSON.stringify(CARRITO.map((i) => i.product)), { status: 200 })
      : new Response("null", { status: 200 }),
  );
});

// espera a que el carrito termine de cargar sus productos
const carritoListo = () => screen.findAllByText("Lattafa Khamrah");
afterEach(() => { vi.restoreAllMocks(); });

function abrir(ui: React.ReactNode, ruta: string) {
  return render(
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>,
  );
}

describe("cálculo del descuento que se muestra", () => {
  it("porcentaje, monto fijo, compra mínima y tope de Q5 por pagar (igual que el backend)", () => {
    expect(discountFor(VERANO, 520)).toBe(52);
    expect(discountFor({ ...VERANO, discount_type: "monto", value: 50 }, 520)).toBe(50);
    expect(discountFor({ ...VERANO, min_purchase: 600 }, 520)).toBe(0);
    expect(discountFor({ ...VERANO, discount_type: "monto", value: 600 }, 520)).toBe(515);
    expect(discountFor(null, 520)).toBe(0);
  });

  it("el cupón aplicado se guarda en la pestaña para pasar del carrito al pago", () => {
    storeCoupon(VERANO);
    expect(readStoredCoupon()).toEqual(VERANO);
    storeCoupon(null);
    expect(readStoredCoupon()).toBeNull();
  });
});

describe("carrito", () => {
  beforeEach(() => {
    localStorage.setItem("luxor-cart", JSON.stringify(CARRITO));
  });

  it("aplica un cupón: muestra el descuento y el total con el envío sobre los productos rebajados", async () => {
    const user = userEvent.setup();
    validar.mockResolvedValue(VERANO);
    abrir(<CartPage />, "/cart");
    await carritoListo();

    await user.type(screen.getByLabelText(/cupón de descuento/i), "verano10");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(validar).toHaveBeenCalledWith("VERANO10", [{ product_id: "khamrah", quantity: 2 }]);
    expect(await screen.findByText("Descuento (VERANO10)")).toBeInTheDocument();
    expect(screen.getByText("−Q52.00")).toBeInTheDocument();
    // Q468 < Q500: paga Q35 de envío → Q503
    expect(screen.getByText("Q503.00")).toBeInTheDocument();
    expect(readStoredCoupon()).toEqual(VERANO);
  });

  it("un cupón vencido, agotado o inventado no descuenta nada y muestra el motivo", async () => {
    const user = userEvent.setup();
    validar.mockRejectedValue(new Error("Este cupón ya venció."));
    abrir(<CartPage />, "/cart");
    await carritoListo();

    await user.type(screen.getByLabelText(/cupón de descuento/i), "VENCIDO");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Este cupón ya venció.");
    expect(screen.queryByText(/^Descuento/)).not.toBeInTheDocument();
    // Q520 ≥ Q500: envío gratis, total sin descuento
    expect(screen.getByText("Q520.00", { selector: ".text-primary-gold" })).toBeInTheDocument();
    expect(readStoredCoupon()).toBeNull();
  });

  it("se puede quitar el cupón aplicado", async () => {
    const user = userEvent.setup();
    storeCoupon(VERANO);
    abrir(<CartPage />, "/cart");
    await carritoListo();

    expect(screen.getByText("−Q52.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar el cupón VERANO10" }));

    expect(screen.queryByText("−Q52.00")).not.toBeInTheDocument();
    expect(readStoredCoupon()).toBeNull();
  });

  it("avisa si el carrito ya no llega a la compra mínima del cupón", async () => {
    storeCoupon({ ...VERANO, min_purchase: 600 });
    abrir(<CartPage />, "/cart");
    await carritoListo();

    expect(screen.getByRole("alert")).toHaveTextContent("Este cupón es para compras desde Q600.00 en productos.");
    expect(screen.queryByText(/^Descuento/)).not.toBeInTheDocument();
  });
});

describe("pago", () => {
  it("al abrir el pago solo se manda el código del cupón, nunca un descuento ni un total", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, checkoutUrl: "https://recurrente.test", reference: "r" }), { status: 201 }),
    );
    const direccion = { deliveryMethod: "recoger", pickupStore: "victoria" } as unknown as Parameters<typeof startCheckout>[1];

    await startCheckout(7, direccion, "VERANO10");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/checkout\/7$/);
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toEqual({ deliveryMethod: "recoger", pickupStore: "victoria", couponCode: "VERANO10" });
  });

  it("sin cupón no manda couponCode", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 201 }));
    await startCheckout(7, { deliveryMethod: "recoger", pickupStore: "victoria" } as unknown as Parameters<typeof startCheckout>[1]);
    const body = JSON.parse(String((vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body));
    expect(body).not.toHaveProperty("couponCode");
  });
});

describe("panel: cupones", () => {
  const CUPON: AdminCoupon = {
    id: 1, code: "VERANO10", discount_type: "porcentaje", value: 10, min_purchase: 300, max_uses: 50,
    expires_at: "2099-12-31T05:59:59.999Z", active: true, created_at: "2026-10-28T10:00:00Z",
    used: 3, reserved: 1, total_discount: 150, state: "activo",
  };

  it("lista los cupones con su estado, usos y descuento total", async () => {
    listar.mockResolvedValue([CUPON]);
    abrir(<AdminCouponsPage />, "/admin/cupones");

    const tarjeta = (await screen.findByText("VERANO10")).closest("li")!;
    expect(within(tarjeta).getByText("Activo")).toBeInTheDocument();
    expect(within(tarjeta).getByText(/10% de descuento · compras desde Q300.00/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/3 de 50 usos · 1 en un pago abierto/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Q150.00 descontados/)).toBeInTheDocument();
  });

  it("crea un cupón con los datos del formulario", async () => {
    const user = userEvent.setup();
    listar.mockResolvedValue([]);
    crear.mockResolvedValue({ ...CUPON, id: 2, code: "FIJO50", discount_type: "monto", value: 50, used: 0, reserved: 0, total_discount: 0 });
    abrir(<AdminCouponsPage />, "/admin/cupones");

    await screen.findByText("Aún no hay cupones.");
    await user.type(screen.getByLabelText("Código"), "fijo50");
    await user.selectOptions(screen.getByLabelText("Tipo"), "monto");
    await user.type(screen.getByLabelText("Monto en quetzales"), "50");
    await user.type(screen.getByLabelText("Límite de usos"), "20");
    await user.type(screen.getByLabelText(/vence/i), "2099-12-31");
    await user.click(screen.getByRole("button", { name: "Crear cupón" }));

    expect(crear).toHaveBeenCalledWith({
      code: "FIJO50", discount_type: "monto", value: "50", min_purchase: "", max_uses: "20", expires_at: "2099-12-31",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Cupón FIJO50 creado.");
    expect(screen.getByText("FIJO50")).toBeInTheDocument();
  });

  it("desactiva un cupón", async () => {
    const user = userEvent.setup();
    listar.mockResolvedValue([CUPON]);
    activar.mockResolvedValue({ ...CUPON, active: false, state: "desactivado" });
    abrir(<AdminCouponsPage />, "/admin/cupones");

    const tarjeta = (await screen.findByText("VERANO10")).closest("li")!;
    await user.click(within(tarjeta).getByRole("button", { name: "Desactivar" }));

    expect(activar).toHaveBeenCalledWith(1, false);
    expect(await within(tarjeta).findByText("Desactivado")).toBeInTheDocument();
    expect(within(tarjeta).getByRole("button", { name: "Activar" })).toBeInTheDocument();
  });

  it("muestra el error del backend si el código ya existe", async () => {
    const user = userEvent.setup();
    listar.mockResolvedValue([]);
    crear.mockRejectedValue(new Error("Ya existe un cupón con ese código."));
    abrir(<AdminCouponsPage />, "/admin/cupones");

    await screen.findByText("Aún no hay cupones.");
    await user.type(screen.getByLabelText("Código"), "VERANO10");
    await user.type(screen.getByLabelText("Porcentaje"), "10");
    await user.type(screen.getByLabelText(/vence/i), "2099-12-31");
    await user.click(screen.getByRole("button", { name: "Crear cupón" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Ya existe un cupón con ese código.");
  });
});
