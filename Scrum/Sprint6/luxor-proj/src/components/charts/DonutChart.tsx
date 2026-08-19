//gráfica de dona
import type { FC } from 'react';

export type DonutChartDatum = {
    label: string;
    value: number;
};

interface DonutChartProps {
    data: DonutChartDatum[];
    formatValue?: (value: number) => string;
    emptyMessage?: string;
}

// colores de las graficas
const COLORS = ['#D4AF37', '#E5D3B3', '#9B673C', '#C2A17E', '#FDFCFB', '#7A5230'];

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const DonutChart: FC<DonutChartProps> = ({
    data,
    formatValue = (value) => String(value),
    emptyMessage = 'Sin datos para mostrar.',
}) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (data.length === 0 || total === 0) {
        return (
            <p className="py-12 text-center text-[11px] uppercase tracking-[0.25em] text-primary-champagne/30 italic">
                {emptyMessage}
            </p>
        );
    }

    let offset = 0;
    const segments = data.map((item, index) => {
        const share = item.value / total;
        const segment = {
            ...item,
            share,
            color: COLORS[index % COLORS.length],
            dash: share * CIRCUMFERENCE,
            offset,
        };
        offset += segment.dash;
        return segment;
    });

    return (
        <div className="flex flex-col md:flex-row items-center gap-10">
            <svg viewBox="0 0 200 200" className="w-48 h-48 shrink-0 -rotate-90">
                <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="24" />
                {segments.map((segment) => (
                    <circle
                        key={segment.label}
                        cx="100"
                        cy="100"
                        r={RADIUS}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="24"
                        strokeDasharray={`${segment.dash} ${CIRCUMFERENCE - segment.dash}`}
                        strokeDashoffset={-segment.offset}
                    >
                        <title>{`${segment.label}: ${formatValue(segment.value)}`}</title>
                    </circle>
                ))}
            </svg>

            <ul className="flex-1 w-full flex flex-col gap-3">
                {segments.map((segment) => (
                    <li key={segment.label} className="flex items-center justify-between gap-4 text-sm">
                        <span className="flex items-center gap-3 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                            <span className="text-primary-champagne truncate">{segment.label}</span>
                        </span>
                        <span className="text-primary-gold shrink-0">
                            {formatValue(segment.value)}
                            <span className="ml-2 text-[10px] uppercase tracking-widest text-primary-champagne/30 italic">
                                {(segment.share * 100).toFixed(1)}%
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
