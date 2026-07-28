import clsx from "clsx";

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
