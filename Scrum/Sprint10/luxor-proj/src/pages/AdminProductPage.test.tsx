// SFTWRKEY-457: subir la foto del perfume desde el panel
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { SearchProvider } from "../context/SearchContext";
import AdminProductPage from "./AdminProductPage";
import { uploadProductImage } from "../services/productService";

vi.mock("../services/productService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/productService")>()),
  fetchCategories: vi.fn().mockResolvedValue([]),
  uploadProductImage: vi.fn(),
}));
const subir = vi.mocked(uploadProductImage);

function abrir() {
  return render(
    <AuthProvider>
      <CartProvider>
        <SearchProvider>
          <MemoryRouter initialEntries={["/admin/nuevo"]}>
            <AdminProductPage />
          </MemoryRouter>
        </SearchProvider>
      </CartProvider>
    </AuthProvider>
  );
}

const foto = (tipo: string, bytes = 1024) => new File([new Uint8Array(bytes)], "perfume", { type: tipo });
// applyAccept en false para poder probar archivos que el selector normalmente esconde
const usuario = () => userEvent.setup({ applyAccept: false });

beforeEach(() => { subir.mockReset(); });

describe("AdminProductPage: subir foto", () => {
  it("sube la foto, pone su ruta en el campo de imagen y muestra la vista previa", async () => {
    subir.mockResolvedValue("/product-images/12.webp");
    abrir();

    const archivo = foto("image/png");
    await usuario().upload(screen.getByLabelText("Subir foto del perfume"), archivo);

    expect(subir).toHaveBeenCalledWith(archivo);
    expect(await screen.findByAltText("Vista previa")).toHaveAttribute("src", "/product-images/12.webp");
    expect(screen.getByLabelText("Imagen")).toHaveValue("/product-images/12.webp");
  });

  it("no sube una foto de más de 5 MB", async () => {
    abrir();

    await usuario().upload(screen.getByLabelText("Subir foto del perfume"), foto("image/jpeg", 5 * 1024 * 1024 + 1));

    expect(await screen.findByRole("alert")).toHaveTextContent("La foto pesa más de 5 MB.");
    expect(subir).not.toHaveBeenCalled();
  });

  it("no sube un archivo que no es PNG, JPG ni WebP", async () => {
    abrir();

    await usuario().upload(screen.getByLabelText("Subir foto del perfume"), foto("image/gif"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sube una foto PNG, JPG o WebP.");
    expect(subir).not.toHaveBeenCalled();
  });

  it("si el backend rechaza la foto muestra su mensaje y no cambia la imagen", async () => {
    subir.mockRejectedValue(new Error("No se pudo leer la foto. Prueba con otra."));
    abrir();

    await usuario().upload(screen.getByLabelText("Subir foto del perfume"), foto("image/webp"));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo leer la foto. Prueba con otra.");
    expect(screen.getByLabelText("Imagen")).toHaveValue("");
    expect(screen.getByText("Sin foto")).toBeInTheDocument();
  });
});

describe("uploadProductImage", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  // SFTWRKEY-451: la sesión del admin va en la cookie httpOnly, que el navegador manda solo
  it("manda el archivo tal cual con su tipo, por /api y sin token en las cabeceras", async () => {
    const { uploadProductImage: real } = await vi.importActual<typeof import("../services/productService")>("../services/productService");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ image: "/product-images/7.webp" }), { status: 201 })
    );
    const archivo = foto("image/png");

    await expect(real(archivo)).resolves.toBe("/product-images/7.webp");

    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/admin/product-images");
    expect(opciones?.method).toBe("POST");
    expect(opciones?.body).toBe(archivo);
    expect(opciones?.headers).toEqual({ "Content-Type": "image/png" });
  });

  it("lanza el mensaje del backend cuando falla", async () => {
    const { uploadProductImage: real } = await vi.importActual<typeof import("../services/productService")>("../services/productService");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "La foto pesa más de 5 MB." }), { status: 413 })
    );

    await expect(real(foto("image/png"))).rejects.toThrow("La foto pesa más de 5 MB.");
  });
});
