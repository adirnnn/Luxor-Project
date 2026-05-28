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
                user: {
                    id: data.user.id,
                    name: data.user.name,
                    role: data.user.role,
                    email: credentials.email,
                },
            };
        }

        if (response.status === 401) {
            return {
                success: false,
                error: "Correo o contraseña incorrectos. Verifica tus datos.",
            };
        }

        if (response.status === 500) {
            return {
                success: false,
                error: "Hubo un problema en el servidor. Intenta más tarde.",
            };
        }

        return {
            success: false,
            error: data.message || "No se pudo iniciar sesión.",
        };

    } catch (err) {
        return {
            success: false,
            error: "No se pudo conectar con el servidor. Verifica tu conexión.",
        };
    }
}