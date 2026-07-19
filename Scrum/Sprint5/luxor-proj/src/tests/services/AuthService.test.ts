import { describe, it, expect, vi, beforeEach } from "vitest";
import { login } from "../../validation/authService";

describe("authService", () => {

    beforeEach(() => {
        vi.restoreAllMocks();
    });

// test de login exitoso
    it("debe retornar el usuario cuando el login es exitoso", async () => {

        const credentials = {
        email: "admin@luxor.com",
        password: "123456"
        };

        vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
            success: true,
            user: {
            id: 1,
            name: "Administrador",
            role: "ADMIN",
            },
        }),
        } as Response);

        const result = await login(credentials);

        expect(result.success).toBe(true);

        expect(result.user).toEqual({
        id: 1,
        name: "Administrador",
        role: "ADMIN",
        email: "admin@luxor.com",
        });

    });

// test de login con credenciales incorrectas
    it("debe retornar un error cuando las credenciales son incorrectas", async () => {

    const credentials = {
        email: "admin@luxor.com",
        password: "incorrecta",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
        success: false,
        }),
    } as Response);

    const result = await login(credentials);

    expect(result).toEqual({
        success: false,
        error: "Correo o contraseña incorrectos. Verifica tus datos.",
    });

    });

});