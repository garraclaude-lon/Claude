import { useEffect, useRef } from 'react';
import { NOMBRES_DATO_PERSONAL, type ZonaPersonal } from '../ia/lectorIA';
import type { Recorte } from '../imagen/anonimizar';

interface Props {
  zonas: ZonaPersonal[];
  /** Franja que se conserva si se recorta; null si recortar quitaría parte del trazado. */
  recorte: Recorte | null;
  aplicando: boolean;
  onOcultar: () => void;
  onRecortar: () => void;
}

/**
 * Ventana roja que avisa que se detectaron datos personales en la imagen y
 * qué se va a hacer con ellos. No se puede cerrar sin anonimizar la imagen.
 */
export function AlertaPrivacidad({ zonas, recorte, aplicando, onOcultar, onRecortar }: Props) {
  const primario = useRef<HTMLButtonElement>(null);
  const tipos = [...new Set(zonas.map((z) => z.tipo))];
  const recomendado = recorte ? 'recortar' : 'ocultar';

  useEffect(() => {
    primario.current?.focus();
  }, []);

  return (
    <div className="modal-fondo" data-testid="alerta-privacidad">
      <div
        className="modal-alerta"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alerta-privacidad-titulo"
        aria-describedby="alerta-privacidad-texto"
      >
        <div className="modal-alerta-icono" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
        </div>
        <h2 id="alerta-privacidad-titulo">Se detectaron datos personales en la imagen</h2>
        <div id="alerta-privacidad-texto" className="modal-alerta-texto">
          <p>La imagen del ECG muestra información que podría identificar al paciente:</p>
          <ul>
            {tipos.map((t) => (
              <li key={t}>{NOMBRES_DATO_PERSONAL[t]}</li>
            ))}
          </ul>
          <p>
            {recomendado === 'recortar' ? (
              <>
                Voy a <strong>recortar la imagen</strong> para quitar la franja donde están esos datos.
              </>
            ) : (
              <>
                Voy a <strong>ocultar esas zonas</strong> con recuadros negros.
              </>
            )}{' '}
            La imagen original se descarta y solo se usa la versión anonimizada. Ninguna imagen se guarda.
          </p>
        </div>
        <div className="modal-alerta-acciones">
          <button
            ref={primario}
            type="button"
            className="boton-peligro"
            onClick={recomendado === 'recortar' ? onRecortar : onOcultar}
            disabled={aplicando}
          >
            {aplicando ? 'Anonimizando…' : recomendado === 'recortar' ? 'Recortar y continuar' : 'Ocultar y continuar'}
          </button>
          {recorte && (
            <button
              type="button"
              className="boton-secundario"
              onClick={recomendado === 'recortar' ? onOcultar : onRecortar}
              disabled={aplicando}
            >
              {recomendado === 'recortar' ? 'Ocultar zonas en lugar de recortar' : 'Recortar en su lugar'}
            </button>
          )}
        </div>
        <p className="modal-alerta-nota">
          Después podés revisar la imagen y tapar a mano cualquier dato que haya quedado visible.
        </p>
      </div>
    </div>
  );
}
