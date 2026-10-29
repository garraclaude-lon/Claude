import type { PointerEvent, ReactNode } from 'react';
import { IconoArbol, IconoCamara, IconoFlecha } from './Iconos';

interface Props {
  onElegir: (modo: 'imagen' | 'guiado') => void;
}

export function PantallaInicio({ onElegir }: Props) {
  return (
    <section className="inicio" aria-label="Modo de trabajo">
      <div className="inicio-opciones">
        <BotonModo
          icono={<IconoCamara />}
          tono="azul"
          etiqueta="Versión simple"
          titulo="Subir ECG"
          onClick={() => onElegir('imagen')}
        >
          Formatos soportados (JPG, PNG, BMP o PDF). La IA propone una lectura experimental y vos
          confirmás cada criterio mirando el trazado.
        </BotonModo>
        <BotonModo
          icono={<IconoArbol />}
          tono="verde"
          etiqueta="Algoritmo de Arruda"
          titulo="Cuestionario guiado"
          onClick={() => onElegir('guiado')}
        >
          Te pregunta, paso a paso y en el orden del algoritmo, cómo ves la onda delta en cada
          derivación. Solo pide los datos que necesita la rama.
        </BotonModo>
      </div>
    </section>
  );
}

interface PropsBoton {
  icono: ReactNode;
  tono: 'azul' | 'verde';
  etiqueta: string;
  titulo: string;
  children: ReactNode;
  onClick: () => void;
}

/**
 * Botón grande con relieve: se inclina levemente hacia el puntero y se
 * hunde al presionarlo. Sin movimiento si el sistema pide reducirlo.
 */
function BotonModo({ icono, tono, etiqueta, titulo, children, onClick }: PropsBoton) {
  const inclinar = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--brillo-x', `${((x + 0.5) * 100).toFixed(0)}%`);
    e.currentTarget.style.setProperty('--brillo-y', `${((y + 0.5) * 100).toFixed(0)}%`);
  };
  const enderezar = (e: PointerEvent<HTMLButtonElement>) => {
    for (const p of ['--rx', '--ry', '--brillo-x', '--brillo-y']) e.currentTarget.style.removeProperty(p);
  };

  return (
    <button
      type="button"
      className={`tarjeta-modo tono-${tono}`}
      onClick={onClick}
      onPointerMove={inclinar}
      onPointerLeave={enderezar}
    >
      <span className="tarjeta-icono" aria-hidden="true">{icono}</span>
      <span className="tarjeta-etiqueta">{etiqueta}</span>
      <span className="tarjeta-titulo">{titulo}</span>
      <span className="tarjeta-desc">{children}</span>
      <span className="tarjeta-ir" aria-hidden="true">
        Comenzar <IconoFlecha />
      </span>
    </button>
  );
}
