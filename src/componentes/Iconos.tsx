/** Íconos de línea, 24×24, heredan el color del texto. */

interface P {
  className?: string;
}

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** Complejo QRS con onda delta (empastamiento inicial). Marca de la app. */
export function Marca({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 48 28" width="48" height="28" fill="none" aria-hidden="true">
      <path
        d="M1 19h8c1.5-3 3.5-3 5 0h2c2.2-.4 3.8-2.4 5-5.5L24 3l3 22 2.4-6H33c2-5.5 6.5-5.5 8.5 0H47"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconoCamara({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function IconoArchivo({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
      <path d="M14 3v4h4M9 14h1.5l1-2 1.5 4 1-2H15" />
    </svg>
  );
}

export function IconoArbol({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <rect x="3" y="17" width="6" height="4" rx="1" />
      <rect x="15" y="17" width="6" height="4" rx="1" />
      <path d="M12 7v4M6 17v-3h12v3" />
    </svg>
  );
}

export function IconoFlecha({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconoAviso({ className }: P) {
  return (
    <svg {...base} className={className} width={18} height={18}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}
