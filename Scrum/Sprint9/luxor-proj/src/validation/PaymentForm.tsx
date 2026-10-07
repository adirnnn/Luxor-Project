import { useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
    usePaymentForm,
    COUNTRY_OPTIONS,
    MONTH_OPTIONS,
    YEAR_OPTIONS,
    type PaymentFormState,
} from "./usePaymentForm";

type FieldProps = {
    id: string;
    label: string;
    value: string;
    error?: string;
    placeholder?: string;
    autoComplete?: string;
    inputMode?: "text" | "numeric";
    className?: string;
    onChange: (value: string) => void;
};

const FormField = ({
    id,
    label,
    value,
    error,
    placeholder,
    autoComplete,
    inputMode,
    className,
    onChange,
}: FieldProps) => (
    <div className={clsx("flex flex-col gap-2", className)}>
        <label
        htmlFor={id}
        className="text-xs font-black tracking-[0.2em] uppercase text-primary-gold"
        >
        {label}
        </label>
        <input
        id={id}
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
            "w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-secondary-charcoal/50",
            "placeholder:text-white/20 focus:ring-2 focus:ring-primary-gold transition-all duration-300 font-medium",
            error ? "ring-2 ring-red-500 bg-red-500/10" : ""
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

// select 
type SelectOption = { value: string; label: string };

type SelectProps = {
    id: string;
    label: string;
    value: string;
    error?: string;
    placeholder: string;
    options: SelectOption[];
    className?: string;
    onChange: (value: string) => void;
};

const FormSelect = ({
    id,
    label,
    value,
    error,
    placeholder,
    options,
    className,
    onChange,
}: SelectProps) => (
    <div className={clsx("flex flex-col gap-2", className)}>
        <label
        htmlFor={id}
        className="text-xs font-black tracking-[0.2em] uppercase text-primary-gold"
        >
        {label}
        </label>
        <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
            "w-full px-6 py-4 rounded-2xl border-none text-base text-primary-champagne bg-secondary-charcoal/50",
            "focus:ring-2 focus:ring-primary-gold transition-all duration-300 font-medium appearance-none",
            error ? "ring-2 ring-red-500 bg-red-500/10" : ""
        )}
        >
        <option value="" className="bg-primary-black">
            {placeholder}
        </option>
        {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-primary-black">
            {opt.label}
            </option>
        ))}
        </select>
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


// Error popup
type ErrorPopupProps = {
    messages: string[];
    onClose: () => void;
};

const ErrorPopup = ({ messages, onClose }: ErrorPopupProps) => (
    <AnimatePresence>
        {messages.length > 0 && (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary-black/80 backdrop-blur-sm px-4"
            onClick={onClose}
        >
            <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-md p-8 md:p-10 border border-red-500/20 shadow-[0_30px_100px_rgba(0,0,0,0.6)]"
            >
            <div className="mx-auto mb-6 w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <svg
                xmlns="http://www.w3.org/2000/svg"
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-500"
                >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>

            <h3 className="text-center mb-4 text-lg md:text-xl font-black uppercase tracking-tight text-primary-champagne">
                No se pudo realizar la compra
            </h3>

            <ul className="mb-8 flex flex-col gap-2">
                {messages.map((msg, i) => (
                <li
                    key={i}
                    className="text-sm text-primary-champagne/70 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-2.5"
                >
                    {msg}
                </li>
                ))}
            </ul>

            <button
                onClick={onClose}
                className="w-full py-4 rounded-button text-sm font-black uppercase tracking-[0.3em] bg-primary-gold text-primary-black hover:bg-primary-champagne transition-all duration-300"
            >
                Entendido
            </button>
            </motion.div>
        </motion.div>
        )}
    </AnimatePresence>
);

//formulario principal

type PaymentFormProps = {
    isProcessing: boolean;
    onValidSubmit: (values: PaymentFormState) => void;
};

export const PaymentForm = ({ isProcessing, onValidSubmit }: PaymentFormProps) => {
    const { values, errors, handleChange, handleSubmit } = usePaymentForm();
    const [popupMessages, setPopupMessages] = useState<string[]>([]);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validationMessages = handleSubmit(onValidSubmit);
        if (validationMessages.length > 0) {
        setPopupMessages(validationMessages);
        }
    };

    return (
        <>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <FormField
            id="pay-name"
            label="Nombre del titular"
            value={values.cardholderName}
            error={errors.cardholderName}
            placeholder="Como aparece en la tarjeta"
            autoComplete="cc-name"
            onChange={(v) => handleChange("cardholderName", v)}
            />

            <FormField
            id="pay-card-number"
            label="Número de tarjeta"
            value={values.cardNumber}
            error={errors.cardNumber}
            placeholder="0000 0000 0000 0000"
            autoComplete="cc-number"
            inputMode="numeric"
            onChange={(v) => handleChange("cardNumber", v)}
            />

            <div className="grid grid-cols-3 gap-5">
            <FormSelect
                id="pay-expiry-month"
                label="Mes"
                value={values.expiryMonth}
                error={errors.expiry}
                placeholder="Mes"
                options={MONTH_OPTIONS}
                onChange={(v) => handleChange("expiryMonth", v)}
            />
            <FormSelect
                id="pay-expiry-year"
                label="Año"
                value={values.expiryYear}
                placeholder="Año"
                options={YEAR_OPTIONS}
                onChange={(v) => handleChange("expiryYear", v)}
            />
            <FormField
                id="pay-cvv"
                label="CVV"
                value={values.cvv}
                error={errors.cvv}
                placeholder="123"
                autoComplete="cc-csc"
                inputMode="numeric"
                onChange={(v) => handleChange("cvv", v)}
            />
            </div>
            {errors.expiry && (
            <p className="-mt-3 text-xs text-red-500 flex items-center gap-1">
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
                {errors.expiry}
            </p>
            )}

            <div className="h-px bg-white/5 my-1" />

            <FormField
            id="pay-address"
            label="Dirección de facturación"
            value={values.billingAddress}
            error={errors.billingAddress}
            placeholder="Calle, número, zona"
            autoComplete="street-address"
            onChange={(v) => handleChange("billingAddress", v)}
            />

            <div className="grid grid-cols-2 gap-5">
            <FormField
                id="pay-city"
                label="Ciudad"
                value={values.city}
                error={errors.city}
                placeholder="Ciudad"
                autoComplete="address-level2"
                onChange={(v) => handleChange("city", v)}
            />
            <FormField
                id="pay-postal"
                label="Código postal"
                value={values.postalCode}
                error={errors.postalCode}
                placeholder="01001"
                autoComplete="postal-code"
                inputMode="numeric"
                onChange={(v) => handleChange("postalCode", v)}
            />
            </div>

            <FormSelect
            id="pay-country"
            label="País"
            value={values.country}
            error={errors.country}
            placeholder="Selecciona un país"
            options={COUNTRY_OPTIONS.map((c) => ({ value: c, label: c }))}
            onChange={(v) => handleChange("country", v)}
            />

            <button
            type="submit"
            disabled={isProcessing}
            className={clsx(
                "mt-4 w-full py-5 md:py-6 rounded-button text-sm md:text-base font-black tracking-[0.3em] uppercase transition-all duration-500",
                !isProcessing
                ? "bg-primary-gold text-primary-black hover:bg-primary-champagne hover:scale-105 shadow-[0_20px_60px_rgba(224,179,84,0.3)]"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            )}
            >
            {isProcessing ? (
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
                Procesando pago…
                </span>
            ) : (
                "Confirmar y pagar"
            )}
            </button>
        </form>

        <ErrorPopup messages={popupMessages} onClose={() => setPopupMessages([])} />
        </>
    );
};