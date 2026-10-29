// Feedback del cliente: foto de perfil. Es privada: el navegador la pide con la cookie de sesión.
import { API_URL } from "./apiClient";
import type { AuthUser } from "../validation/authService";

export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const avatarUrl = (user: Pick<AuthUser, "id" | "avatarVersion">) =>
    user.avatarVersion ? `${API_URL}/user/${user.id}/avatar?v=${user.avatarVersion}` : null;

async function check(res: Response, fallback: string) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || fallback);
    return data;
}

export async function uploadAvatar(userId: number, file: File): Promise<number> {
    const res = await fetch(`${API_URL}/user/${userId}/avatar`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
    });
    return (await check(res, "No se pudo subir la foto.")).avatarVersion as number;
}

export async function deleteAvatar(userId: number): Promise<void> {
    await check(await fetch(`${API_URL}/user/${userId}/avatar`, { method: "DELETE" }), "No se pudo quitar la foto.");
}
