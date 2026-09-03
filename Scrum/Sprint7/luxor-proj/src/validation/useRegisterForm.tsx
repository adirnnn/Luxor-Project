import { useState, useCallback } from "react";

export interface RegisterFormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterFormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  credentials?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: RegisterFormState): RegisterFormErrors {
  const errs: RegisterFormErrors = {};

  if (!values.name.trim()) {
    errs.name = "El nombre es requerido.";
  } else if (values.name.trim().length < 2) {
    errs.name = "El nombre debe tener al menos 2 caracteres.";
  }

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

  if (!values.confirmPassword) {
    errs.confirmPassword = "Confirma tu contraseña.";
  } else if (values.password !== values.confirmPassword) {
    errs.confirmPassword = "Las contraseñas no coinciden.";
  }

  return errs;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export function useRegisterForm() {
  const [values, setValues] = useState<RegisterFormState>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = useCallback(
    (field: keyof RegisterFormState, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined, credentials: undefined }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (onSuccess: (user: { id: number; name: string; email: string; role: string }) => void) => {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setIsLoading(true);
      setErrors({});

      try {
        const res = await fetch(`${API_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            email: values.email,
            password: values.password,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setIsSuccess(true);
          onSuccess(data.user);
        } else if (res.status === 500) {
          setErrors({ credentials: "El correo ya está registrado o hubo un error en el servidor." });
        } else {
          setErrors({ credentials: data.message || "No se pudo crear la cuenta." });
        }
      } catch {
        setErrors({ credentials: "No se pudo conectar con el servidor." });
      } finally {
        setIsLoading(false);
      }
    },
    [values]
  );

  const fieldErrors = validate(values);
  const isValid =
    Object.keys(fieldErrors).length === 0 &&
    values.name.trim() !== "" &&
    values.email.trim() !== "" &&
    values.password !== "" &&
    values.confirmPassword !== "";

  return { values, errors, isLoading, isSuccess, handleChange, handleSubmit, isValid };
}