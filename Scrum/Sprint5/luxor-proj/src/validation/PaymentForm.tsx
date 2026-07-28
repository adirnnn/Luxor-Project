import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";

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