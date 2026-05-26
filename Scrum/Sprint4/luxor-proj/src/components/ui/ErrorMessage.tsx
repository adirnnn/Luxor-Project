type Props = {
  message: string;
};

export const ErrorMessage = ({ message }: Props) => (
  <div className="py-16 text-center bg-white/30 rounded-3xl border border-primary-beige">
    <svg
      className="mx-auto mb-4 text-red-400"
      xmlns="http://www.w3.org/2000/svg"
      width="32" height="32" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    <p className="text-sm text-red-500">{message}</p>
    <p className="text-xs text-secondary-brown mt-2">Verifica tu conexión e intenta de nuevo.</p>
  </div>
);