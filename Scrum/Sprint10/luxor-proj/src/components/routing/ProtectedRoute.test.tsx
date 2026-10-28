// SFTWRKEY-422: rutas protegidas por sesion y por rol
import { lazy, Suspense } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { vi } from "vitest";
import { AuthProvider, useAuth } from "../../context/AuthContext";
import LoginPage from "../../pages/LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";
import { login } from "../../validation/authService";

vi.mock("../../validation/authService", () => ({ login: vi.fn() }));
const loginApi = vi.mocked(login);

// el boton real de Google, cuando el backend responde, solo llama a login() del contexto
// (CommerceFeatures.tsx). Aqui se simula ese mismo paso sin cargar el SDK de Google.
vi.mock("../../features/CommerceFeatures", async () => {
  const { useAuth } = await import("../../context/AuthContext");
  return {
    GoogleAccess: () => {
      const { login: entrar } = useAuth();
      return (
        <button onClick={() => entrar({ id: 9, name: "Luis", email: "luis@gmail.com", role: "CLIENTE" })}>
          Google simulado
        </button>
      );
    },
  };
});

// muestra la ruta actual para poder revisar a donde termino el usuario
function Ubicacion() {
  return <p data-testid="ruta">{useLocation().pathname}</p>;
}

// mismas rutas protegidas que App.tsx, con paginas de prueba
function abrir(ruta: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<p>Panel admin</p>} />
            <Route path="/reporte" element={<p>Reportes</p>} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/mi-cuenta" element={<p>Mi cuenta</p>} />
          </Route>
        </Routes>
        <Ubicacion />
      </MemoryRouter>
    </AuthProvider>
  );
}

function sesionDe(role: string) {
  localStorage.setItem("luxor-auth-user", JSON.stringify({ id: 7, name: "Ana", email: "ana@test.com", role }));
}

beforeEach(() => { loginApi.mockReset(); });
afterEach(() => { localStorage.clear(); });

describe("AdminRoute", () => {
  it("un cliente que abre /admin termina en el inicio", () => {
    sesionDe("CLIENTE");
    abrir("/admin");
    expect(screen.getByTestId("ruta")).toHaveTextContent(/^\/$/);
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.queryByText("Panel admin")).not.toBeInTheDocument();
  });

  it("un cliente tampoco ve /reporte", () => {
    sesionDe("CLIENTE");
    abrir("/reporte");
    expect(screen.getByTestId("ruta")).toHaveTextContent(/^\/$/);
    expect(screen.queryByText("Reportes")).not.toBeInTheDocument();
  });

  it("un admin entra a /admin", () => {
    sesionDe("ADMIN");
    abrir("/admin");
    expect(screen.getByTestId("ruta")).toHaveTextContent("/admin");
    expect(screen.getByText("Panel admin")).toBeInTheDocument();
  });

  it("un visitante sin sesion que abre /admin va al login", () => {
    abrir("/admin");
    expect(screen.getByTestId("ruta")).toHaveTextContent("/login");
    expect(screen.queryByText("Panel admin")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute", () => {
  it("un cliente con sesion entra a /mi-cuenta", () => {
    sesionDe("CLIENTE");
    abrir("/mi-cuenta");
    expect(screen.getByText("Mi cuenta")).toBeInTheDocument();
  });

  it("un visitante que abre /mi-cuenta termina en /login y, tras iniciar sesion, vuelve a /mi-cuenta", async () => {
    loginApi.mockResolvedValue({
      success: true,
      user: { id: 7, name: "Ana", email: "ana@test.com", role: "CLIENTE" },
    });
    const user = userEvent.setup();
    abrir("/mi-cuenta");

    expect(screen.getByTestId("ruta")).toHaveTextContent("/login");
    expect(screen.queryByText("Mi cuenta")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@test.com");
    await user.type(screen.getByLabelText("Contraseña"), "test1234");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText("Mi cuenta")).toBeInTheDocument();
    expect(screen.getByTestId("ruta")).toHaveTextContent("/mi-cuenta");
    // SFTWRKEY-451: el token queda en la cookie httpOnly, nunca en localStorage
    expect(localStorage.getItem("luxor-auth-token")).toBeNull();
    expect(JSON.parse(localStorage.getItem("luxor-auth-user") ?? "{}").id).toBe(7);
  });

  it("con Google tambien vuelve a /mi-cuenta despues de entrar", async () => {
    const user = userEvent.setup();
    abrir("/mi-cuenta");
    expect(screen.getByTestId("ruta")).toHaveTextContent("/login");

    await user.click(screen.getByRole("button", { name: "Google simulado" }));

    expect(await screen.findByText("Mi cuenta")).toBeInTheDocument();
    expect(screen.getByTestId("ruta")).toHaveTextContent("/mi-cuenta");
  });

  it("si se entra al login directamente, despues de iniciar sesion va al inicio como antes", async () => {
    loginApi.mockResolvedValue({
      success: true,
      user: { id: 7, name: "Ana", email: "ana@test.com", role: "CLIENTE" },
    });
    const user = userEvent.setup();
    abrir("/login");

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@test.com");
    await user.type(screen.getByLabelText("Contraseña"), "test1234");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(await screen.findByText("Inicio")).toBeInTheDocument();
    expect(screen.getByTestId("ruta")).toHaveTextContent(/^\/$/);
  });
});

// igual que AnimatedRoutes de App.tsx: la pagina vieja sigue montada mientras sale
function SalirBoton() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return <button onClick={() => { logout(); navigate("/"); }}>Salir</button>;
}

function RutasAnimadas() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<motion.p exit={{ opacity: 0 }}>Inicio</motion.p>} />
        <Route path="/login" element={<p>Login</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/mi-cuenta" element={<motion.div exit={{ opacity: 0 }}>Mi cuenta <SalirBoton /></motion.div>} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<motion.div exit={{ opacity: 0 }}>Panel admin <SalirBoton /></motion.div>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

describe("cerrar sesion desde una ruta protegida", () => {
  for (const [rol, ruta] of [["CLIENTE", "/mi-cuenta"], ["ADMIN", "/admin"]]) {
    it(`${rol} que sale desde ${ruta} termina en el inicio, no en el login`, async () => {
      sesionDe(rol);
      const user = userEvent.setup();
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <RutasAnimadas />
            <Ubicacion />
          </MemoryRouter>
        </AuthProvider>
      );

      await user.click(screen.getByRole("button", { name: "Salir" }));

      expect(await screen.findByText("Inicio")).toBeInTheDocument();
      expect(screen.getByTestId("ruta")).toHaveTextContent(/^\/$/);
      expect(screen.queryByText("Login")).not.toBeInTheDocument();
    });
  }
});

// SFTWRKEY-457: las paginas se cargan por partes (React.lazy). Un visitante sin permiso no debe
// quedarse trabado en la pagina protegida ni descargarla mientras sale hacia el login.
describe("paginas que se cargan por partes", () => {
  for (const [guardia, ruta] of [["AdminRoute", "/admin"], ["ProtectedRoute", "/mi-cuenta"]] as const) {
    it(`un visitante sin sesion que abre ${ruta} llega al login sin cargar la pagina protegida`, async () => {
      const cargarPagina = vi.fn(() => Promise.resolve({ default: () => <p>Pagina protegida</p> }));
      const Pagina = lazy(cargarPagina);
      const Guardia = guardia === "AdminRoute" ? AdminRoute : ProtectedRoute;

      function Rutas() {
        const location = useLocation();
        return (
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/login" element={<motion.p exit={{ opacity: 0 }}>Login</motion.p>} />
              <Route element={<Guardia />}>
                <Route path={ruta} element={<motion.div exit={{ opacity: 0 }}><Suspense fallback={<p>Cargando...</p>}><Pagina /></Suspense></motion.div>} />
              </Route>
            </Routes>
          </AnimatePresence>
        );
      }

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <Rutas />
            <Ubicacion />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText("Login")).toBeInTheDocument();
      expect(screen.getByTestId("ruta")).toHaveTextContent("/login");
      expect(screen.queryByText("Pagina protegida")).not.toBeInTheDocument();
      expect(cargarPagina).not.toHaveBeenCalled();
    });
  }
});
