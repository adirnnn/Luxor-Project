

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthUser {
    id: string;
    email: string;
    name: string;
}

export interface AuthResult {
    success: boolean;
    user?: AuthUser;
    error?: string;
}

const MOCK_USERS: Array<LoginCredentials & AuthUser> = [
{
    id: "usr_001",
    email: "admin@joyeroarabe.com",
    password: "Luxor2024!",
    name: "Administrador",
    },
{
    id: "usr_002",
    email: "demo@joyeroarabe.com",
    password: "demo1234",
    name: "Usuario Demo",
},
];


export async function mockLogin(
credentials: LoginCredentials
): Promise<AuthResult> {

    
await new Promise((resolve) => setTimeout(resolve, 800));

const match = MOCK_USERS.find(
    (u) =>
        u.email.toLowerCase() === credentials.email.toLowerCase() &&
        u.password === credentials.password
    );

if (match) {
    return {
        success: true,
        user: { id: match.id, email: match.email, name: match.name },
    };
}

return {
    success: false,
    error: "Correo o contraseña incorrectos.",
    };
}
