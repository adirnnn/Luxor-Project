

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthUser {
    id: number;
    email: string;
    name: string;
    role?: string;
}

export interface AuthResult {
    success: boolean;
    user?: AuthUser;
    error?: string;
}

export async function login(
    credentials: LoginCredentials
): Promise<AuthResult> {
    try {
        const response = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(credentials),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return {
                success: true,
                user: data.user,
            };
        } else {
            return {
                success: false,
                error: data.message || "Correo o contraseña incorrectos.",
            };
        }
    } catch (err) {
        return {
            success: false,
            error: "No se pudo conectar con el servidor.",
        };
    }
}
