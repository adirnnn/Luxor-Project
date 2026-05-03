// src/features/auth/LoginForm.tsx
// Presentational form component.
// All logic lives in useLoginForm — this component only renders.

import { useState } from "react";
import clsx from "clsx";
import { useLoginForm } from "../validation/useLoginForm";
import type { AuthUser } from "../validation/authService";

// ─── Sub-components ───────────────────────────────────────────────────────────

type InputProps = {
id: string;
label: string;
type: string;
value: string;
error?: string;
placeholder?: string;
autoComplete?: string;
disabled?: boolean;
onChange: (value: string) => void;
};

const FormInput = ({
id,
label,
type,
value,
error,
placeholder,
autoComplete,
disabled,
onChange,
}: InputProps) => (
    <div className="flex flex-col gap-1.5">
    <label
        htmlFor={id}
        className="text-xs font-medium tracking-widest uppercase text-secondary-brown"
    >
        {label}
    </label>
    <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
        "w-full px-4 py-3 rounded-xl border text-sm text-primary-black bg-white/70",
        "placeholder:text-secondary-brown/40",
        "focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        error
            ? "border-red-400 bg-red-50/30"
            : "border-primary-beige hover:border-secondary-brown/40"
        )}
    />
    {error && (
    <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {error}
    </p>
    )}
</div>
);

// ─── Password field with show/hide toggle ─────────────────────────────────────

type PasswordInputProps = Omit<InputProps, "type">;

const PasswordInput = (props: PasswordInputProps) => {
const [show, setShow] = useState(false);

return (
    <div className="relative flex flex-col gap-1.5">
    <label
        htmlFor={props.id}
        className="text-xs font-medium tracking-widest uppercase text-secondary-brown"
        >
        {props.label}
        </label>
        <div className="relative">
        <input
            id={props.id}
            type={show ? "text" : "password"}
            value={props.value}
            placeholder={props.placeholder}
            autoComplete={props.autoComplete}
            disabled={props.disabled}
            onChange={(e) => props.onChange(e.target.value)}
            className={clsx(
            "w-full px-4 py-3 pr-12 rounded-xl border text-sm text-primary-black bg-white/70",
            "placeholder:text-secondary-brown/40",
            "focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-transparent",
            "transition-all duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            props.error
                ? "border-red-400 bg-red-50/30"
                : "border-primary-beige hover:border-secondary-brown/40"
            )}
        />
        <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-brown/60 hover:text-secondary-brown transition-colors p-1"
            tabIndex={-1}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
            {show ? (
            // Eye-off icon
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
            ) : (
            // Eye icon
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
            )}
        </button>
        </div>
        {props.error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {props.error}
        </p>
        )}
    </div>
);
};

// ─── Main form ────────────────────────────────────────────────────────────────

type LoginFormProps = {
    onSuccess: (user: AuthUser) => void;
};

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
const {
    values,
    errors,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
    isValid,
    } = useLoginForm();
    
    const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(onSuccess);
    };
    
    return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {/* Credential error banner */}
        {errors.credentials && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {errors.credentials}
        </div>
        )}
    
      {/* Email field */}
        <FormInput
        id="login-email"
        label="Correo electrónico"
        type="email"
        value={values.email}
        error={errors.email}
        placeholder="correo@ejemplo.com"
        autoComplete="email"
        disabled={isLoading || isSuccess}
        onChange={(v) => handleChange("email", v)}
        />
    
      {/* Password field */}
        <PasswordInput
        id="login-password"
        label="Contraseña"
        value={values.password}
        error={errors.password}
        placeholder="••••••••"
        autoComplete="current-password"
        disabled={isLoading || isSuccess}
        onChange={(v) => handleChange("password", v)}
        />
    
      {/* Submit button */}
        <button
        type="submit"
        disabled={!isValid || isLoading || isSuccess}
        className={clsx(
            "mt-2 w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200",
            isValid && !isLoading && !isSuccess
            ? "bg-primary-gold text-primary-black hover:opacity-90 active:scale-[0.98]"
            : "bg-primary-beige text-secondary-brown cursor-not-allowed opacity-60"
        )}
        >
        {isLoading ? (
            <span className="flex items-center justify-center gap-2">
            <svg
                className="animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
            </svg>
            Verificando…
            </span>
        ) : isSuccess ? (
            "¡Acceso concedido!"
        ) : (
            "Iniciar sesión"
        )}
        </button>
    </form>
    );
};