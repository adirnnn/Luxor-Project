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