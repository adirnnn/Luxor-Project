import React from 'react';

interface ErrorMessageProps {
    message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
    return (
        <div className="flex flex-col items-center justify-center py-32 gap-6 bg-primary-black">
            <p className="text-[12px] text-primary-gold/80 tracking-widest uppercase font-bold bg-primary-gold/10 px-6 py-3 rounded-full border border-primary-gold/20">
                {message}
            </p>
        </div>
    );
};
