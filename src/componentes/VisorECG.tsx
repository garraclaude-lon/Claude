import { useState } from 'react';

interface Props {
  url: string;
  nombre: string;
}

const NIVELES = [1, 1.5, 2, 3, 4];

/** Muestra la imagen del ECG con zoom; se desplaza dentro de su recuadro. */
export function VisorECG({ url, nombre }: Props) {
  const [nivel, setNivel] = useState(0);
  const zoom = NIVELES[nivel];
  return (
    <figure className="visor" aria-label="Imagen del ECG">
      <div className="visor-barra">
        <span className="visor-nombre" title={nombre}>{nombre}</span>
        <div className="visor-zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => setNivel((n) => Math.max(0, n - 1))} disabled={nivel === 0} aria-label="Alejar">
            −
          </button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setNivel((n) => Math.min(NIVELES.length - 1, n + 1))}
            disabled={nivel === NIVELES.length - 1}
            aria-label="Acercar"
          >
            +
          </button>
        </div>
      </div>
      <div className="visor-lienzo" tabIndex={0} aria-label="Imagen del ECG, desplazable">
        <img src={url} alt={`ECG cargado: ${nombre}`} style={{ width: `${zoom * 100}%` }} />
      </div>
    </figure>
  );
}
