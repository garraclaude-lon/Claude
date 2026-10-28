import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RegionAnatomica } from '../algoritmo/tipos';
import type { ControlEscena, Vista } from '../corazon3d/escena';

interface Props {
  regiones: RegionAnatomica[];
  onCerrar: () => void;
}

function hayWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const reducirMovimiento = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const temaOscuro = () => {
  const forzado = document.documentElement.getAttribute('data-theme');
  if (forzado) return forzado === 'dark';
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/** Ventana con el corazón 3D esquemático y el LED en la ubicación predicha. */
export function Visor3D({ regiones, onCerrar }: Props) {
  const lienzo = useRef<HTMLDivElement>(null);
  const control = useRef<ControlEscena | null>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin_webgl' | 'error'>(() => (hayWebGL() ? 'cargando' : 'sin_webgl'));
  const [pausado, setPausado] = useState(reducirMovimiento);
  const [lento, setLento] = useState(false);
  const [vista, setVista] = useState<Vista>('frontal');
  const [etiquetas, setEtiquetas] = useState(false);
  const [coronarias, setCoronarias] = useState(false);

  useEffect(() => {
    cerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    const raiz = document.getElementById('root');
    raiz?.setAttribute('inert', '');
    return () => {
      window.removeEventListener('keydown', alTeclear);
      raiz?.removeAttribute('inert');
    };
  }, [onCerrar]);

  useEffect(() => {
    if (estado !== 'cargando' || !lienzo.current) return;
    let vivo = true;
    import('../corazon3d/escena')
      .then(({ crearEscena }) =>
        crearEscena(lienzo.current!, { regiones: regiones.map((r) => r.codigo), pausado, oscuro: temaOscuro() }),
      )
      .then((c) => {
        if (!vivo) return c.destruir();
        control.current = c;
        setEstado('listo');
      })
      .catch((e) => {
        console.error('Ubicación 3D:', e);
        if (vivo) setEstado('error');
      });
    return () => {
      vivo = false;
      control.current?.destruir();
      control.current = null;
    };
    // La escena se crea una sola vez; los controles se aplican aparte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => control.current?.pausar(pausado), [pausado]);
  useEffect(() => control.current?.velocidad(lento ? 0.25 : 1), [lento]);
  useEffect(() => control.current?.vista(vista), [vista]);
  useEffect(() => control.current?.etiquetas(etiquetas), [etiquetas, estado]);
  useEffect(() => control.current?.coronarias(coronarias), [coronarias, estado]);

  const nombres = regiones.map((r) => r.abreviatura).join(' o ');

  return createPortal(
    <div className="modal-fondo modal-3d-fondo">
      <div className="modal-3d" role="dialog" aria-modal="true" aria-labelledby="titulo-3d" data-testid="visor-3d">
        <header className="modal-3d-cabecera">
          <div>
            <h2 id="titulo-3d">Ubicación 3D</h2>
            <p className="modal-3d-sub">
              Vía accesoria predicha: <strong>{nombres}</strong>
              {regiones.length === 1 && <> · {regiones[0].descripcion}</>}
            </p>
          </div>
          <button ref={cerrar} type="button" className="boton-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="modal-3d-lienzo" ref={lienzo} role="img" aria-label={`Corazón 3D anatómico con el sistema de conducción y un LED rojo en la región ${nombres}.`}>
          {estado === 'cargando' && <p className="modal-3d-msj">Cargando modelo anatómico…</p>}
          {estado === 'sin_webgl' && (
            <p className="modal-3d-msj" data-testid="sin-webgl">
              Este dispositivo o navegador no puede mostrar gráficos 3D (WebGL). Usá el esquema de los anillos AV del resultado.
            </p>
          )}
          {estado === 'error' && <p className="modal-3d-msj">No se pudo cargar el modelo 3D.</p>}
        </div>

        <div className="modal-3d-controles">
          <div className="segmentado" role="group" aria-label="Vista">
            <button type="button" aria-pressed={vista === 'via'} onClick={() => setVista('via')}>Vía accesoria</button>
            <button type="button" aria-pressed={vista === 'frontal'} onClick={() => setVista('frontal')}>Frontal</button>
            <button type="button" aria-pressed={vista === 'anillos'} onClick={() => setVista('anillos')}>Anillos AV</button>
          </div>
          <div className="segmentado" role="group" aria-label="Velocidad">
            <button type="button" aria-pressed={!lento} onClick={() => setLento(false)}>Normal</button>
            <button type="button" aria-pressed={lento} onClick={() => setLento(true)}>Lenta ×¼</button>
          </div>
          <button type="button" className="boton-secundario" onClick={() => setPausado((p) => !p)}>
            {pausado ? 'Reanudar' : 'Pausar'}
          </button>
          <div className="interruptores" role="group" aria-label="Capas">
            <button type="button" className="interruptor" aria-pressed={etiquetas} onClick={() => setEtiquetas((v) => !v)}>
              <span className="interruptor-pista" aria-hidden="true"><span /></span>
              Referencias anatómicas
            </button>
            <button type="button" className="interruptor" aria-pressed={coronarias} onClick={() => setCoronarias((v) => !v)}>
              <span className="interruptor-pista" aria-hidden="true"><span /></span>
              Vasos coronarios
            </button>
          </div>
        </div>

        <p className="modal-3d-nota">
          Modelo anatómico de un adulto de referencia, no del paciente; el sistema de conducción está
          trazado de forma aproximada. La ubicación es la predicción del algoritmo, no una localización
          confirmada. Girá el corazón arrastrando con el mouse o deslizando un dedo; acercá con la rueda o
          pellizcando con dos dedos.
          <br />
          Modelo: <a href="https://github.com/Z-Anatomy/Models-of-human-anatomy" target="_blank" rel="noreferrer">Z-Anatomy</a> (
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>), basado en
          BodyParts3D © The Database Center for Life Science (CC BY 4.0). Corazón extraído y simplificado.
        </p>
      </div>
    </div>,
    document.body,
  );
}
