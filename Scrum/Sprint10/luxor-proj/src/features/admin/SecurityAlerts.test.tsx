// SFTWRKEY-401
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SecurityAlerts } from "./SecurityAlerts";
import { fetchSecurityAlerts } from "../../services/securityService";

vi.mock("../../services/securityService", () => ({ fetchSecurityAlerts: vi.fn() }));
const obtener = vi.mocked(fetchSecurityAlerts);

beforeEach(() => { obtener.mockReset(); });

describe("SecurityAlerts", () => {
  it("muestra una alerta por IP y otra por cuenta cuando se supera el umbral", async () => {
    obtener.mockResolvedValue({
      threshold: 10,
      windowMinutes: 15,
      alerts: [
        { kind: "ip", target: "203.0.113.50", attempts: 10, last_at: "2026-09-29T10:00:00Z" },
        { kind: "account", target: "admin@test.com", attempts: 14, last_at: "2026-09-29T10:00:00Z" },
      ],
      recent: [
        { id: "1", type: "RATE_LIMITED", ip: "203.0.113.50", email: null, path: "/login", created_at: "2026-09-29T10:00:00Z" },
      ],
    });
    render(<SecurityAlerts />);

    expect(await screen.findByText(/fuerza bruta desde la IP 203\.0\.113\.50: 10 logins fallidos/)).toBeInTheDocument();
    expect(screen.getByText(/la cuenta admin@test\.com recibió 14 logins fallidos/i)).toBeInTheDocument();
    expect(screen.getByText("2 activas")).toBeInTheDocument();
    expect(screen.getByText("Bloqueo por exceso de intentos")).toBeInTheDocument();
  });

  it("indica que no hay actividad sospechosa si no hay alertas", async () => {
    obtener.mockResolvedValue({ threshold: 10, windowMinutes: 15, alerts: [], recent: [] });
    render(<SecurityAlerts />);

    expect(await screen.findByText("Sin alertas")).toBeInTheDocument();
    expect(screen.getByText(/ninguna IP ni cuenta llegó a 10 logins fallidos/)).toBeInTheDocument();
  });

  it("muestra el error si no se pueden cargar las alertas", async () => {
    obtener.mockImplementation(async () => {
      throw new Error("No tienes permiso para realizar esta acción.");
    });
    render(<SecurityAlerts />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para realizar esta acción.");
  });
});
