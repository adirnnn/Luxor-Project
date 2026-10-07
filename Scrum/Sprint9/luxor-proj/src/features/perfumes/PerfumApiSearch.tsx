import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { searchExternalPerfumes } from "../../services/perfumApiService";
import type { ExternalPerfumeCandidate } from "../../services/perfumApiService";

type PerfumApiSearchProps = {
    onSelect: (candidate: ExternalPerfumeCandidate) => void;
};

const COLD_START_HINT_MS = 4000;
const DEBOUNCE_MS = 400;

export function PerfumApiSearch({ onSelect }: PerfumApiSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ExternalPerfumeCandidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [showColdStartHint, setShowColdStartHint] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            setResults([]);
            setError(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        const coldStartTimer = setTimeout(() => {
            if (!cancelled) setShowColdStartHint(true);
        }, COLD_START_HINT_MS);

        const debounceTimer = setTimeout(async () => {
            try {
                const data = await searchExternalPerfumes(trimmed);
                if (!cancelled) {
                    setResults(data);
                    setIsOpen(true);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "No se pudo buscar en PerfumAPI.");
                    setResults([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setShowColdStartHint(false);
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(coldStartTimer);
            clearTimeout(debounceTimer);
        };
    }, [query]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (candidate: ExternalPerfumeCandidate) => {
        onSelect(candidate);
        setQuery(candidate.name);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-gold italic">
                Buscar en PerfumAPI
            </label>
            <div className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-primary-black/40 border border-white/5 focus-within:ring-2 focus-within:ring-primary-gold transition-all duration-300">
                <svg className="text-primary-gold shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    placeholder="Ej: Bleu de Chanel, Khamrah, Sauvage..."
                    className="flex-1 bg-transparent text-sm text-primary-champagne placeholder:text-white/20 focus:outline-none"
                />
                {loading && (
                    <div className="w-4 h-4 border-2 border-primary-gold/20 border-t-primary-gold rounded-full animate-spin shrink-0" />
                )}
            </div>

            <AnimatePresence>
                {isOpen && query.trim().length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 mt-2 z-20 bg-primary-black/95 backdrop-blur-2xl border border-white/[0.08] rounded-[20px] overflow-hidden shadow-2xl"
                    >
                        {error ? (
                            <div className="py-6 px-5 text-center">
                                <p className="text-xs text-red-500 font-bold italic">{error}</p>
                            </div>
                        ) : loading ? (
                            <div className="py-8 text-center px-5">
                                <p className="text-xs text-primary-champagne/40 uppercase tracking-[0.2em] font-medium">
                                    {showColdStartHint
                                        ? "Conectando con PerfumAPI, puede tardar unos segundos..."
                                        : "Buscando..."}
                                </p>
                            </div>
                        ) : results.length > 0 ? (
                            <ul className="py-2 max-h-80 overflow-y-auto">
                                {results.map((candidate) => (
                                    <li key={candidate.external_id ?? candidate.name}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(candidate)}
                                            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/[0.04] transition-all duration-200 text-left group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-primary-black/60 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                                                {candidate.image ? (
                                                    <img
                                                        src={candidate.image}
                                                        alt={candidate.name}
                                                        className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-500"
                                                    />
                                                ) : (
                                                    <span className="text-[8px] text-primary-champagne/20 uppercase">Sin img</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-primary-champagne truncate">{candidate.name}</p>
                                                <p className="text-xs text-primary-champagne/40 truncate italic">{candidate.brand}</p>
                                            </div>
                                            {candidate.warnings.length > 0 && (
                                                <span
                                                    title={candidate.warnings.join(" ")}
                                                    className="shrink-0 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-[9px] font-bold uppercase tracking-wider"
                                                >
                                                    Incompleto
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="py-8 text-center">
                                <p className="text-xs text-primary-champagne/30 uppercase tracking-[0.2em] font-medium">Sin resultados para</p>
                                <p className="text-sm text-primary-champagne/60 italic mt-1">"{query}"</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
