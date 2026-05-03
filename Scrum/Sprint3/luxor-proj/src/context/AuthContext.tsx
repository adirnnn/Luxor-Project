import React, { createContext, useContext, useState } from "react";
import type { AuthUser } from "../validation/authService";

interface AuthContextType {
    user: AuthUser | null;
    login: (user: AuthUser) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "luxor-auth-user";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        try {
            const saved = localStorage.getItem(SESSION_KEY);
            return saved ? (JSON.parse(saved) as AuthUser) : null;
        } catch {
            return null;
        }
    });

    const login = (authUser: AuthUser) => {
        setUser(authUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem(SESSION_KEY);
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