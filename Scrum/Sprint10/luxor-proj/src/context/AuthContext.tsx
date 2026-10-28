import React, { createContext, startTransition, useContext, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../validation/authService";
import { API_URL } from "../services/apiClient";

interface AuthContextType {
    user: AuthUser | null;
    login: (user: AuthUser) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

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

    // al abrir el sitio se pregunta al backend si la cookie sigue vigente (dura 8 horas)
    useEffect(() => {
        if (!savedUser()) return;
        const controller = new AbortController();
        const alPreguntar = cambiosDeSesion.current;
        fetch(`${API_URL}/me`, { signal: controller.signal })
            .then(async (res) => {
                if (cambiosDeSesion.current !== alPreguntar) return;
                if (res.status === 401) {
                    // la sesión venció o se cerró en otra pestaña
                    localStorage.removeItem(SESSION_KEY);
                    startTransition(() => setUser(null));
                    return;
                }
                if (!res.ok) return;
                const { user: actual } = await res.json();
                if (!actual?.id || cambiosDeSesion.current !== alPreguntar) return;
                const publico: AuthUser = { id: actual.id, name: actual.name, email: actual.email, role: actual.role };
                localStorage.setItem(SESSION_KEY, JSON.stringify(publico));
                setUser(publico);
            })
            // sin conexión se deja la sesión como estaba; las páginas avisan si el backend no responde
            .catch(() => {});
        return () => controller.abort();
    }, []);

    const login = (authUser: AuthUser) => {
        cambiosDeSesion.current += 1;
        setUser(authUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
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
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: user !== null }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};
