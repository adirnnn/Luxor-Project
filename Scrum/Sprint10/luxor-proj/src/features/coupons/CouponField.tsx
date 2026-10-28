import { useId, useState, type FC, type FormEvent } from "react";
import type { PublicCoupon } from "../../services/couponService";
import { formatPrice } from "../../utils/formatPrice";
import { couponLabel } from "./coupon";

// SFTWRKEY-432: campo para escribir el cupón, o el cupón aplicado con su botón para quitarlo
type Props = {
    coupon: PublicCoupon | null;
    belowMinimum?: boolean;
    error: string | null;
    checking: boolean;
    disabled?: boolean;
    onApply: (code: string) => void;
    onRemove: () => void;
};

export const CouponField: FC<Props> = ({ coupon, belowMinimum = false, error, checking, disabled = false, onApply, onRemove }) => {
    const [code, setCode] = useState("");
    const inputId = useId();

    if (coupon) {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-primary-gold/30 bg-primary-gold/5 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-sm font-black tracking-widest text-primary-gold">{coupon.code}</p>
                        <p className="text-xs text-primary-champagne/50">{couponLabel(coupon)}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={disabled}
                        aria-label={`Quitar el cupón ${coupon.code}`}
                        className="shrink-0 text-[10px] uppercase tracking-widest text-primary-champagne/50 hover:text-status-error transition-colors disabled:opacity-40"
                    >
                        Quitar
                    </button>
                </div>
                {belowMinimum && (
                    <p role="alert" className="text-xs text-status-warning">
                        Este cupón es para compras desde {formatPrice(coupon.min_purchase)} en productos.
                    </p>
                )}
                {error && <p role="alert" className="text-xs text-status-error">{error}</p>}
            </div>
        );
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onApply(code);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-xs text-primary-champagne/40 uppercase tracking-widest">
                Cupón de descuento
            </label>
            <div className="flex gap-2">
                <input
                    id={inputId}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={30}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={disabled || checking}
                    placeholder="CÓDIGO"
                    className="min-w-0 flex-1 bg-white/10 rounded-lg px-3 py-2 text-sm tracking-widest text-primary-champagne placeholder:text-primary-champagne/30 focus:outline-none focus:ring-2 focus:ring-primary-gold"
                />
                <button
                    type="submit"
                    disabled={disabled || checking}
                    className="shrink-0 border border-primary-gold text-primary-gold rounded-lg px-4 py-2 text-xs uppercase tracking-widest hover:bg-primary-gold hover:text-primary-black transition-colors disabled:opacity-40"
                >
                    {checking ? "Revisando..." : "Aplicar"}
                </button>
            </div>
            {error && <p role="alert" className="text-xs text-status-error">{error}</p>}
        </form>
    );
};
