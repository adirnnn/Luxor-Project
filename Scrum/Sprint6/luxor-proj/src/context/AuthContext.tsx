import React, { createContext, useContext, useState } from "react";
import type { AuthUser } from "../validation/authService";
import { TOKEN_KEY } from "../services/apiClient";

interface AuthContextType {
    user: AuthUser | null;
    login: (user: AuthUser, token: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "luxor-auth-user";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        try {
            const saved = localStorage.getItem(SESSION_KEY);
            const hasToken = !!localStorage.getItem(TOKEN_KEY);
            return saved && hasToken ? (JSON.parse(saved) as AuthUser) : null;
        } catch {
            return null;
        }
    });

    const login = (authUser: AuthUser, token: string) => {
        setUser(authUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
        localStorage.setItem(TOKEN_KEY, token);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(TOKEN_KEY);
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