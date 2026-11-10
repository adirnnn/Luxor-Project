import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

// Si alguna parte de la página da error al dibujarse, React la borra entera y solo quedaba el fondo
// negro. Esto la atrapa y muestra un aviso para recargar. Va por fuera del router y de los contextos
// (App.tsx), así que usa enlaces normales en vez de <Link>.
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Error al mostrar la página:", error, info.componentStack);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div role="alert" className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-6 bg-primary-black">
                <p className="text-[10px] text-primary-gold tracking-[0.4em] uppercase font-black">Algo salió mal</p>
                <h1 className="text-4xl md:text-6xl font-serif italic text-primary-champagne">No pudimos mostrar esta página</h1>
                <p className="max-w-md text-sm md:text-base text-primary-champagne/70">
                    Recarga la página para intentarlo de nuevo. Tu carrito sigue guardado.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-8 py-4 rounded-button bg-primary-gold text-primary-black text-xs font-bold tracking-widest uppercase transition-all duration-500 hover:bg-primary-champagne hover:scale-105"
                    >
                        Recargar la página
                    </button>
                    <a href="/" className="text-xs font-black text-primary-gold uppercase tracking-widest hover:text-primary-champagne">
                        Volver al inicio
                    </a>
                </div>
            </div>
        );
    }
}
