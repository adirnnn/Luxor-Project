import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Product } from "../services/productService";
import { fetchProducts } from "../services/productService";

interface SearchContextType {
    query: string;
    results: Product[];
    isOpen: boolean;
    setQuery: (q: string) => void;
    clearSearch: () => void;
    openSearch: () => void;
    closeSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [query, setQueryState] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    // Catalogo real desde la BD, no el arreglo estatico de data/products.ts:
    // asi la busqueda publica refleja el stock que el admin realmente tiene
    // disponible (tarea fuera de la Epica 3, pedida explicitamente).
    const [catalog, setCatalog] = useState<Product[]>([]);

    useEffect(() => {
        fetchProducts()
            .then(setCatalog)
            .catch(() => setCatalog([]));
    }, []);

    const normalize = (str: string) =>
        str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const results: Product[] = query.trim().length > 0
        ? catalog.filter((p) => {
            if (!p.stock || p.stock <= 0) return false;
            const q = normalize(query);
            return (
                normalize(p.name).includes(q) ||
                normalize(p.description).includes(q) ||
                normalize(p.notes.salida).includes(q) ||
                normalize(p.notes.corazon).includes(q) ||
                normalize(p.notes.fondo).includes(q)
            );
            })
        : [];
    const setQuery = useCallback((q: string) => {
        setQueryState(q);
    }, []);

    const clearSearch = useCallback(() => {
        setQueryState("");
        setIsOpen(false);
    }, []);

    const openSearch = useCallback(() => setIsOpen(true), []);
    const closeSearch = useCallback(() => {
        setIsOpen(false);
        setQueryState("");
    }, []);

    return (
        <SearchContext.Provider value={{ query, results, isOpen, setQuery, clearSearch, openSearch, closeSearch }}>
            {children}
        </SearchContext.Provider>
        );
};

export const useSearch = (): SearchContextType => {
    const ctx = useContext(SearchContext);
    if (!ctx) throw new Error("useSearch must be used inside SearchProvider");
    return ctx;
};
