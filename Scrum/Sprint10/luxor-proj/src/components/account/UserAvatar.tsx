import clsx from "clsx";
import type { AuthUser } from "../../validation/authService";
import { avatarUrl } from "../../services/avatarService";

// Feedback del cliente: la foto de perfil, o la inicial del nombre si todavía no tiene foto
export function UserAvatar({ user, className }: { user: AuthUser; className?: string }) {
    const src = avatarUrl(user);
    return src ? (
        <img src={src} alt={`Foto de ${user.name}`} className={clsx("rounded-full object-cover", className)} />
    ) : (
        <span
            aria-hidden="true"
            className={clsx("flex items-center justify-center rounded-full bg-primary-gold font-bold text-primary-black", className)}
        >
            {user.name?.charAt(0).toUpperCase() ?? "U"}
        </span>
    );
}
