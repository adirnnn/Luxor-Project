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

    // los perfumes del inventario de la tienda no traen notas (llegan en null): un dato vac\u00edo
    // cuenta como texto vac\u00edo, si no la b\u00fasqueda se cae y la p\u00e1gina queda en negro
    const normalize = (str?: string | null) =>
        (str ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const q = normalize(query.trim());
    const results: Product[] = q.length > 0
        ? catalog.filter((p) => {
            if (!p.stock || p.stock <= 0) return false;
            return [p.name, p.brand, p.description, p.notes?.salida, p.notes?.corazon, p.notes?.fondo]
                .some((campo) => normalize(campo).includes(q));
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
