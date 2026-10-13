import React from 'react';
import { Link } from 'react-router-dom';

interface NotFoundMessageProps {
    eyebrow?: string;
    title: string;
    message: string;
    linkTo?: string;
    linkLabel?: string;
}

// SFTWRKEY-423: aviso de "no encontrado" con la identidad de Perfumería Victoria.
// Lo usan la página 404 y el detalle de un producto que no existe.
export const NotFoundMessage: React.FC<NotFoundMessageProps> = ({
    eyebrow = 'Error 404',
    title,
    message,
    linkTo = '/',
    linkLabel = 'Volver al inicio',
}) => {
    return (
        <div className="flex flex-col items-center justify-center text-center py-32 px-6 gap-6 bg-primary-black">
            <p className="text-[10px] text-primary-gold tracking-[0.4em] uppercase font-black">{eyebrow}</p>
            <h1 className="text-4xl md:text-6xl font-serif italic text-primary-champagne">{title}</h1>
            <p className="max-w-md text-sm md:text-base text-primary-champagne/70">{message}</p>
            <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
                <Link
                    to={linkTo}
                    className="px-8 py-4 rounded-button bg-primary-gold text-primary-black text-xs font-bold tracking-widest uppercase transition-all duration-500 hover:bg-primary-champagne hover:scale-105"
                >
                    {linkLabel}
                </Link>
                {linkTo !== '/perfumes' && (
                    <Link
                        to="/perfumes"
                        className="text-xs font-black text-primary-gold uppercase tracking-widest hover:text-primary-champagne"
                    >
                        Ver el catálogo
                    </Link>
                )}
            </div>
        </div>
    );
};
