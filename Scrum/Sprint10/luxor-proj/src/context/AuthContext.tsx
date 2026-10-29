import React, { createContext, startTransition, useContext, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../validation/authService";
import { API_URL } from "../services/apiClient";

interface AuthContextType {
    user: AuthUser | null;
    login: (user: AuthUser) => void;
    logout: () => void;
    isAuthenticated: boolean;
    // la sesión venció (8 horas) o se cerró en otra pestaña: se avisa en vez de fallar en silencio
    sessionExpired: boolean;
    dismissSessionExpired: () => void;
    // vuelve a leer /me (por ejemplo, después de cambiar la foto de perfil)
    refreshSession: () => void;
}

// rutas que pueden responder 401 sin que signifique que la sesión venció
const AUTH_ROUTES = /\/(login|logout|register|me)(\?|$)|\/auth\//;
// cada cuánto se revisa que la sesión siga vigente mientras la pestaña está abierta
const SESSION_CHECK_MS = 5 * 60_000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// SFTWRKEY-451: el token vive en una cookie httpOnly que JavaScript no puede leer. Aquí solo se
// guardan los datos públicos del usuario (nombre y rol) para pintar la página sin esperar al backend.
const SESSION_KEY = "luxor-auth-user";
// donde se guardaba el token antes: se borra de los navegadores que todavía lo tengan
const OLD_TOKEN_KEY = "luxor-auth-token";

const savedUser = (): AuthUser | null => {
    try {
        localStorage.removeItem(OLD_TOKEN_KEY);
        const saved = localStorage.getItem(SESSION_KEY);
        return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
        return null;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(savedUser);
    // cambia en cada login o logout: así una respuesta de /me que llega tarde no deshace un logout
    const cambiosDeSesion = useRef(0);

    const [sessionExpired, setSessionExpired] = useState(false);
    // el login no trae el porcentaje de mayorista: después de entrar se pregunta a /me
    const revisarSesion = useRef<() => void>(() => {});
    const userRef = useRef(user);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // la sesión venció: se limpia y se avisa (solo si había alguien con sesión)
    const expireSession = useRef(() => {
        if (!userRef.current) return;
        cambiosDeSesion.current += 1;
        localStorage.removeItem(SESSION_KEY);
        setSessionExpired(true);
        startTransition(() => setUser(null));
    });

    // pregunta al backend si la cookie sigue vigente (dura 8 horas): al abrir el sitio, cada 5
    // minutos y al volver a la pestaña. Así el panel no muestra listas vacías con la sesión vencida.
    useEffect(() => {
        let controller: AbortController | null = null;
        const revisar = () => {
            if (!userRef.current) return;
            controller?.abort();
            controller = new AbortController();
            const alPreguntar = cambiosDeSesion.current;
            fetch(`${API_URL}/me`, { signal: controller.signal })
                .then(async (res) => {
                    if (cambiosDeSesion.current !== alPreguntar) return;
                    if (res.status === 401) {
                        expireSession.current();
                        return;
                    }
                    if (!res.ok) return;
                    const { user: actual } = await res.json();
                    if (!actual?.id || cambiosDeSesion.current !== alPreguntar) return;
                    const publico: AuthUser = {
                        id: actual.id,
                        name: actual.name,
                        email: actual.email,
                        role: actual.role,
                        wholesalePercent: actual.wholesalePercent,
                        avatarVersion: actual.avatarVersion ?? null,
                    };
                    localStorage.setItem(SESSION_KEY, JSON.stringify(publico));
                    setUser(publico);
                })
                // sin conexión se deja la sesión como estaba; las páginas avisan si el backend no responde
                .catch(() => {});
        };
        const alVolver = () => {
            if (document.visibilityState === "visible") revisar();
        };
        revisarSesion.current = revisar;
        revisar();
        const intervalo = window.setInterval(revisar, SESSION_CHECK_MS);
        document.addEventListener("visibilitychange", alVolver);
        return () => {
            controller?.abort();
            window.clearInterval(intervalo);
            document.removeEventListener("visibilitychange", alVolver);
        };
    }, []);

    // cualquier petición a la API que responda 401 con sesión abierta también la da por vencida
    useEffect(() => {
        const original = window.fetch;
        const conAviso: typeof window.fetch = async (input, init) => {
            const res = await original(input, init);
            if (res.status === 401) {
                const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
                if (url.startsWith(`${API_URL}/`) && !AUTH_ROUTES.test(url)) expireSession.current();
            }
            return res;
        };
        window.fetch = conAviso;
        return () => {
            if (window.fetch === conAviso) window.fetch = original;
        };
    }, []);

    const login = (authUser: AuthUser) => {
        cambiosDeSesion.current += 1;
        setSessionExpired(false);
        setUser(authUser);
        userRef.current = authUser;
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
        revisarSesion.current();
    };

    const logout = () => {
        cambiosDeSesion.current += 1;
        // SFTWRKEY-422: react-router cambia de pagina en una transicion; si el logout no va
        // en la misma, hay un render sin sesion en la pagina vieja y ProtectedRoute manda al login
        startTransition(() => setUser(null));
        localStorage.removeItem(SESSION_KEY);
        // la cookie es httpOnly: solo el backend la puede borrar
        void fetch(`${API_URL}/logout`, { method: "POST" }).catch(() => {});
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                logout,
                isAuthenticated: user !== null,
                sessionExpired,
                dismissSessionExpired: () => setSessionExpired(false),
                refreshSession: () => revisarSesion.current(),
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};
