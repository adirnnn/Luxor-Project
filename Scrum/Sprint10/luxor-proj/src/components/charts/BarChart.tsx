// gráfica de barras 
import type { FC } from 'react';

export type BarChartDatum = {
    label: string;
    value: number;
    caption?: string;
};

interface BarChartProps {
    data: BarChartDatum[];
    orientation?: 'vertical' | 'horizontal';
    formatValue?: (value: number) => string;
    emptyMessage?: string;
}

export const BarChart: FC<BarChartProps> = ({
    data,
    orientation = 'vertical',
    formatValue = (value) => String(value),
    emptyMessage = 'Sin datos para mostrar.',
}) => {
    const max = Math.max(0, ...data.map((item) => item.value));

    if (data.length === 0 || max === 0) {
        return (
            <p className="py-12 text-center text-[11px] uppercase tracking-[0.25em] text-primary-champagne/30 italic">
                {emptyMessage}
            </p>
        );
    }

    if (orientation === 'horizontal') {
        return (
            <div className="flex flex-col gap-5">
                {data.map((item) => (
                    <div key={item.label} className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between gap-4">
                            <span className="text-sm text-primary-champagne truncate">{item.label}</span>
                            <span className="text-sm text-primary-gold shrink-0">{formatValue(item.value)}</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary-amber via-primary-gold to-primary-sand transition-all duration-700"
                                style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
                            />
                        </div>
                        {item.caption && (
                            <span className="text-[10px] uppercase tracking-[0.25em] text-primary-champagne/30 italic">
                                {item.caption}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-end gap-1.5 md:gap-3 h-56">
                {data.map((item) => (
                    <div key={item.label} className="flex-1 flex flex-col justify-end items-center gap-2 h-full group">
                        <span className="text-[10px] text-primary-gold/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                            {formatValue(item.value)}
                        </span>
                        <div
                            className="w-full rounded-t-lg bg-gradient-to-t from-primary-amber/60 via-primary-gold/80 to-primary-sand transition-all duration-700 group-hover:from-primary-gold group-hover:to-primary-champagne"
                            style={{ height: `${Math.max((item.value / max) * 100, 1.5)}%` }}
                            title={`${item.label}: ${formatValue(item.value)}`}
                        />
                    </div>
                ))}
            </div>
            <div className="flex gap-1.5 md:gap-3">
                {data.map((item) => (
                    <span
                        key={item.label}
                        className="flex-1 text-center text-[9px] md:text-[10px] uppercase tracking-widest text-primary-champagne/40 truncate"
                    >
                        {item.caption ?? item.label}
                    </span>
                ))}
            </div>
        </div>
    );
};
