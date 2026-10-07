import { useEffect, useState } from "react";
import { fetchSecurityAlerts } from "../../services/securityService";
import type { SecurityAlert, SecurityAlertsData } from "../../services/securityService";

// SFTWRKEY-401: alertas de seguridad en el panel
const REFRESH_MS = 30_000;

const EVENT_LABELS: Record<string, string> = {
    LOGIN_FAILED: "Login fallido",
    RATE_LIMITED: "Bloqueo por exceso de intentos",
};

const formatDate = (value: string) => new Date(value).toLocaleString();

function alertMessage(alert: SecurityAlert, windowMinutes: number) {
    return alert.kind === "ip"
        ? `Posible fuerza bruta desde la IP ${alert.target}: ${alert.attempts} logins fallidos en los últimos ${windowMinutes} minutos.`
        : `La cuenta ${alert.target} recibió ${alert.attempts} logins fallidos en los últimos ${windowMinutes} minutos.`;
}

export function SecurityAlerts() {
    const [data, setData] = useState<SecurityAlertsData | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const controller = new AbortController();

        async function update() {
            try {
                const next = await fetchSecurityAlerts(controller.signal);
                if (!cancelled) {
                    setData(next);
                    setError("");
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "Error de conexión.");
                }
            } finally {
                if (!cancelled) {
                    timer = setTimeout(update, REFRESH_MS);
                }
            }
        }

        void update();

        return () => {
            cancelled = true;
            clearTimeout(timer);
            controller.abort();
        };
    }, []);

    const hasAlerts = !!data?.alerts.length;

    return (
        <section
            aria-label="Alertas de seguridad"
            className={`glass-card p-6 md:p-10 flex flex-col gap-6 ${hasAlerts ? "border-status-error/40" : "border-white/5"}`}
        >
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg md:text-2xl font-heading font-light uppercase tracking-widest text-primary-champagne">
                    Alertas de seguridad
                </h2>
                {data && (
                    <span
                        className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${hasAlerts ? "bg-status-error-bg text-status-error" : "bg-status-success-bg text-status-success"}`}
                    >
                        {hasAlerts ? `${data.alerts.length} activa${data.alerts.length === 1 ? "" : "s"}` : "Sin alertas"}
                    </span>
                )}
            </div>

            {error && <p role="alert" className="text-status-error text-sm">{error}</p>}
            {!data && !error && <p className="text-primary-champagne/40 text-sm">Cargando alertas…</p>}

            {data && (
                <>
                    {hasAlerts ? (
                        <ul aria-live="polite" className="flex flex-col gap-3">
                            {data.alerts.map((alert) => (
                                <li
                                    key={`${alert.kind}-${alert.target}`}
                                    className="rounded-xl border border-status-error/30 bg-status-error-bg p-4 text-sm text-primary-champagne"
                                >
                                    <p>{alertMessage(alert, data.windowMinutes)}</p>
                                    <p className="mt-1 text-xs text-primary-champagne/50">
                                        Último intento: {formatDate(alert.last_at)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-primary-champagne/60">
                            Sin actividad sospechosa: ninguna IP ni cuenta llegó a {data.threshold} logins fallidos
                            en los últimos {data.windowMinutes} minutos.
                        </p>
                    )}

                    <details className="text-sm text-primary-champagne/70">
                        <summary className="cursor-pointer select-none text-primary-champagne/50 uppercase tracking-widest text-[10px] font-black">
                            Eventos de las últimas 24 horas ({data.recent.length})
                        </summary>
                        {data.recent.length ? (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="text-primary-champagne/40 uppercase tracking-widest">
                                        <tr>
                                            <th className="py-2 pr-4 font-bold">Fecha</th>
                                            <th className="py-2 pr-4 font-bold">Evento</th>
                                            <th className="py-2 pr-4 font-bold">IP</th>
                                            <th className="py-2 pr-4 font-bold">Cuenta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.recent.map((event) => (
                                            <tr key={event.id} className="border-t border-white/5">
                                                <td className="py-2 pr-4 whitespace-nowrap">{formatDate(event.created_at)}</td>
                                                <td className="py-2 pr-4">{EVENT_LABELS[event.type] ?? event.type}</td>
                                                <td className="py-2 pr-4">{event.ip ?? "—"}</td>
                                                <td className="py-2 pr-4">{event.email ?? "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="mt-3">No hay eventos registrados.</p>
                        )}
                    </details>
                </>
            )}
        </section>
    );
}
