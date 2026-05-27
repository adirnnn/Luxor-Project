import React, { createContext, useContext, useState, useCallback } from "react";
import type { Product } from "../data/products";
import { products as localProducts } from "../data/products";

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

const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const results: Product[] = query.trim().length > 0
    ? localProducts.filter((p) => {
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