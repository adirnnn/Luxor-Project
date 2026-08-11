import { useState, useCallback } from "react";

export interface PaymentFormState {
    cardholderName: string;
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    billingAddress: string;
    city: string;
    postalCode: string;
    country: string;
}

export interface PaymentFormErrors {
    cardholderName?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    billingAddress?: string;
    city?: string;
    postalCode?: string;
    country?: string;
}

export const COUNTRY_OPTIONS = [
    "Guatemala",
    "Otro",
];

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
    const value = String(i + 1).padStart(2, "0");
    return { value, label: String(i + 1) };
});

const CURRENT_YEAR = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => {
    const year = CURRENT_YEAR + i;
    return { value: String(year), label: String(year) };
});

const INITIAL_STATE: PaymentFormState = {
    cardholderName: "",
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
    billingAddress: "",
    city: "",
    postalCode: "",
    country: "",
};

// Función para formatear el número de tarjeta en bloques de 4 dígitos
function formatCardNumber(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatCvv(raw: string): string {
    // CVV siempre de 3 dígitos.
    return raw.replace(/\D/g, "").slice(0, 3);
}

function formatPostalCode(raw: string): string {
    return raw.replace(/\D/g, "").slice(0, 10);
}

// Aplica el formateador correspondiente según el campo
function applyMask(field: keyof PaymentFormState, value: string): string {
    switch (field) {
        case "cardNumber":
        return formatCardNumber(value);
        case "cvv":
        return formatCvv(value);
        case "postalCode":
        return formatPostalCode(value);
        default:
        return value;
    }
}

// validacion 

function isExpiryInFuture(month: string, year: string): boolean {
    if (!month || !year) return false;

    const monthNum = Number(month);
    const yearNum = Number(year);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (yearNum < currentYear) return false;
    if (yearNum === currentYear && monthNum < currentMonth) return false;
    return true;
    }

    function validate(values: PaymentFormState): PaymentFormErrors {
    const errs: PaymentFormErrors = {};

    if (!values.cardholderName.trim()) {
        errs.cardholderName = "El nombre del titular es requerido.";
    } else if (values.cardholderName.trim().length < 3) {
        errs.cardholderName = "Ingresa el nombre completo del titular.";
    } else if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(values.cardholderName.trim())) {
        errs.cardholderName = "El nombre solo puede contener letras.";
    }

    const cardDigits = values.cardNumber.replace(/\D/g, "");
    if (!cardDigits) {
        errs.cardNumber = "El número de tarjeta es requerido.";
    } else if (cardDigits.length !== 16) {
        errs.cardNumber = "El número de tarjeta debe tener 16 dígitos.";
    }

    if (!values.expiryMonth || !values.expiryYear) {
        errs.expiry = "Selecciona el mes y el año de vencimiento.";
    } else if (!isExpiryInFuture(values.expiryMonth, values.expiryYear)) {
        errs.expiry = "La tarjeta está vencida. Selecciona una fecha válida.";
    }

    if (!values.cvv) {
        errs.cvv = "El CVV es requerido.";
    } else if (!/^\d{3}$/.test(values.cvv)) {
        errs.cvv = "El CVV debe tener exactamente 3 dígitos.";
    }

    if (!values.billingAddress.trim()) {
        errs.billingAddress = "La dirección de facturación es requerida.";
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