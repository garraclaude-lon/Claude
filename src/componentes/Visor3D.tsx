import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RegionAnatomica } from '../algoritmo/tipos';
import type { ControlEscena } from '../corazon3d/escena';

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
  const [vista, setVista] = useState<'frontal' | 'anillos'>('frontal');

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
      .then(({ crearEscena }) => {
        if (!vivo || !lienzo.current) return;
        control.current = crearEscena(lienzo.current, {
          regiones: regiones.map((r) => r.codigo),
          pausado,
          oscuro: temaOscuro(),
        });
        setEstado('listo');
      })
      .catch(() => vivo && setEstado('error'));
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

  const nombres = regiones.map((r) => r.abreviatura).join(' o ');

  return createPortal(
    <div className="modal-fondo modal-3d-fondo">
      <div className="modal-3d" role="dialog" aria-modal="true" aria-labelledby="titulo-3d" data-testid="visor-3d">
        <header className="modal-3d-cabecera">
          <div>
            <h2 id="titulo-3d">3D location</h2>
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

        <div className="modal-3d-lienzo" ref={lienzo} role="img" aria-label={`Corazón 3D esquemático con el sistema de conducción y un LED rojo en la región ${nombres}.`}>
          {estado === 'cargando' && <p className="modal-3d-msj">Cargando modelo 3D…</p>}
          {estado === 'sin_webgl' && (
            <p className="modal-3d-msj" data-testid="sin-webgl">
              Este dispositivo o navegador no puede mostrar gráficos 3D (WebGL). Usá el esquema de los anillos AV del resultado.
            </p>
          )}
          {estado === 'error' && <p className="modal-3d-msj">No se pudo cargar el modelo 3D.</p>}
        </div>

        <div className="modal-3d-controles">
          <div className="segmentado" role="group" aria-label="Vista">
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
        </div>

        <ul className="modal-3d-leyenda">
          <li><i className="ley-led" aria-hidden="true" /> Vía accesoria (LED rojo)</li>
          <li><i className="ley-conduccion" aria-hidden="true" /> Sistema de conducción</li>
          <li><i className="ley-cruce" aria-hidden="true" /> Preexcitación: el impulso cruza por la vía antes que por el His</li>
        </ul>
        <p className="modal-3d-nota">
          Modelo esquemático con fines didácticos: no es una reconstrucción anatómica ni del paciente. La
          ubicación es la predicción del algoritmo, no una localización confirmada. Arrastrá para girar y
          usá la rueda o el gesto de pellizcar para acercar.
        </p>
      </div>
    </div>,
    document.body,
  );
}
