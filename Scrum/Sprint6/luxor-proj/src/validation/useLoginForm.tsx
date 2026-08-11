
import { useState, useCallback } from "react";
import { login } from "../validation/authService";
import type { AuthUser } from "../validation/authService";

export interface LoginFormState {
    email: string;
    password: string;
}

export interface LoginFormErrors {
    email?: string;
    password?: string;
    credentials?: string;
}

export interface UseLoginFormReturn {
    values: LoginFormState;
    errors: LoginFormErrors;
    isLoading: boolean;
    isSuccess: boolean;
    handleChange: (field: keyof LoginFormState, value: string) => void;
    handleSubmit: (onSuccess: (user: AuthUser) => void) => Promise<void>;
    isValid: boolean;
}


const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: LoginFormState): LoginFormErrors {
    const errs: LoginFormErrors = {};
    
    if (!values.email.trim()) {
    errs.email = "El correo es requerido.";
} else if (!EMAIL_REGEX.test(values.email)) {
    errs.email = "Ingresa un correo válido.";
}

    if (!values.password) {
    errs.password = "La contraseña es requerida.";
    } else if (values.password.length < 6) {
    errs.password = "La contraseña debe tener al menos 6 caracteres.";
    }
    return errs;
} 
export function useLoginForm(): UseLoginFormReturn {
    const [values, setValues] = useState<LoginFormState>({
    email: "",
    password: "",
    });
    const [errors, setErrors] = useState<LoginFormErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    
    const handleChange = useCallback(
    (field: keyof LoginFormState, value: string) => {
        setValues((prev) => ({ ...prev, [field]: value }));
        
        setErrors((prev) => ({ ...prev, [field]: undefined, credentials: undefined }));
    },
    []
    );
    
    const handleSubmit = useCallback(
    async (onSuccess: (user: AuthUser) => void) => {
      // Run validation
        const validationErrors = validate(values);
        if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
        }
    
        setIsLoading(true);
        setErrors({});
    
        try {
        const result = await login(values);

        if (result.success && result.user) {
            setIsSuccess(true);
            onSuccess(result.user);
        } else {
            setErrors({ credentials: result.error });
        }
        } catch {
        setErrors({ credentials: "Error inesperado. Intenta de nuevo." });
        } finally {
        setIsLoading(false);
        }
    },
    [values]
);

const fieldErrors = validate(values);
const isValid =
    Object.keys(fieldErrors).length === 0 &&
    values.email.trim() !== "" &&
    values.password !== "";

return {
    values,
    errors,
    isLoading,
    isSuccess,
    handleChange,
    handleSubmit,
    isValid,
    };
}