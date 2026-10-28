import { useState, useCallback } from "react";

// SFTWRKEY-445: la tarjeta se ingresa en la página de Recurrente; aquí solo va la entrega.
// SFTWRKEY-449: envío a domicilio (con dirección) o recoger en uno de los locales.
export interface PaymentFormState {
    deliveryMethod: "envio" | "recoger";
    pickupStore: string;
    billingAddress: string;
    city: string;
    postalCode: string;
    country: string;
}

export interface PaymentFormErrors {
    pickupStore?: string;
    billingAddress?: string;
    city?: string;
    postalCode?: string;
    country?: string;
}

export const COUNTRY_OPTIONS = [
    "Guatemala",
    "Otro",
];

const INITIAL_STATE: PaymentFormState = {
    deliveryMethod: "envio",
    pickupStore: "",
    billingAddress: "",
    city: "",
    postalCode: "",
    country: "",
};

function formatPostalCode(raw: string): string {
    return raw.replace(/\D/g, "").slice(0, 10);
}

// Aplica el formateador correspondiente según el campo
function applyMask(field: keyof PaymentFormState, value: string): string {
    switch (field) {
        case "postalCode":
        return formatPostalCode(value);
        default:
        return value;
    }
}

// validacion 

    function validate(values: PaymentFormState): PaymentFormErrors {
    const errs: PaymentFormErrors = {};

    // al recoger en tienda solo hace falta elegir el local
    if (values.deliveryMethod === "recoger") {
        if (!values.pickupStore) errs.pickupStore = "Elige el local donde vas a recoger tu pedido.";
        return errs;
    }

    if (!values.billingAddress.trim()) {
        errs.billingAddress = "La dirección de envío es requerida.";
    } else if (values.billingAddress.trim().length < 5) {
        errs.billingAddress = "Ingresa una dirección más completa.";
    }

    if (!values.city.trim()) {
        errs.city = "La ciudad es requerida.";
    } else if (values.city.trim().length < 2) {
        errs.city = "Ingresa una ciudad válida.";
    }

    if (!values.postalCode.trim()) {
        errs.postalCode = "El código postal es requerido.";
    } else if (values.postalCode.trim().length < 4) {
        errs.postalCode = "El código postal debe tener al menos 4 dígitos.";
    }

    if (!values.country.trim()) {
        errs.country = "El país es requerido.";
    }

    return errs;
}

export interface UsePaymentFormReturn {
    values: PaymentFormState;
    errors: PaymentFormErrors;
    handleChange: (field: keyof PaymentFormState, value: string) => void;
    // Devuelve la lista de mensajes de error 
    handleSubmit: (onValid: (values: PaymentFormState) => void) => string[];
    isValid: boolean;
}

export function usePaymentForm(): UsePaymentFormReturn {
    const [values, setValues] = useState<PaymentFormState>(INITIAL_STATE);
    const [errors, setErrors] = useState<PaymentFormErrors>({});

    const handleChange = useCallback(
    (field: keyof PaymentFormState, rawValue: string) => {
        const value = applyMask(field, rawValue);
        setValues((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
    );

    const handleSubmit = useCallback(
    (onValid: (values: PaymentFormState) => void) => {
        const validationErrors = validate(values);
        const messages = Object.values(validationErrors).filter(
        (m): m is string => Boolean(m)
        );

        if (messages.length > 0) {
        setErrors(validationErrors);
        return messages;
        }

        setErrors({});
        onValid(values);
        return [];
    },
    [values]
    );

    const fieldErrors = validate(values);
    const isValid = Object.keys(fieldErrors).length === 0;

    return { values, errors, handleChange, handleSubmit, isValid };
}