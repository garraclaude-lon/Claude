import { useRef, useState, type PointerEvent } from 'react';
import { normalizarCaja, type Caja } from '../imagen/anonimizar';

interface Props {
  url: string;
  nombre: string;
  aplicando: boolean;
  onAplicar: (cajas: Caja[]) => void;
  onCancelar: () => void;
}

/** Permite dibujar rectángulos sobre la imagen para taparlos a mano. */
export function TaparZonas({ url, nombre, aplicando, onAplicar, onCancelar }: Props) {
  const lienzo = useRef<HTMLDivElement>(null);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [trazo, setTrazo] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const fraccion = (e: PointerEvent) => {
    const r = lienzo.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const empezar = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = fraccion(e);
    setTrazo({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (!trazo) return;
    const p = fraccion(e);
    setTrazo({ ...trazo, x1: p.x, y1: p.y });
  };
  const terminar = () => {
    if (!trazo) return;
    const c = normalizarCaja(trazo.x0, trazo.y0, trazo.x1, trazo.y1);
    if (c.ancho > 0.01 && c.alto > 0.005) setCajas((cs) => [...cs, c]);
    setTrazo(null);
  };

  const enCurso = trazo ? normalizarCaja(trazo.x0, trazo.y0, trazo.x1, trazo.y1) : null;
  const estilo = (c: Caja) => ({
    left: `${c.x * 100}%`,
    top: `${c.y * 100}%`,
    width: `${c.ancho * 100}%`,
    height: `${c.alto * 100}%`,
  });

  return (
    <div className="tapar-zonas">
      <p className="nota">Arrastrá sobre la imagen para marcar cada zona que quieras tapar.</p>
      <div
        ref={lienzo}
        className="tapar-lienzo"
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={() => setTrazo(null)}
        data-testid="tapar-lienzo"
      >
        <img src={url} alt={`ECG para anonimizar: ${nombre}`} draggable={false} />
        {cajas.map((c, i) => (
          <span key={i} className="tapar-caja" style={estilo(c)} />
        ))}
        {enCurso && <span className="tapar-caja en-curso" style={estilo(enCurso)} />}
      </div>
      <div className="acciones">
        <button
          type="button"
          className="boton-peligro"
          disabled={cajas.length === 0 || aplicando}
          onClick={() => onAplicar(cajas)}
        >
          {aplicando ? 'Tapando…' : `Tapar ${cajas.length === 1 ? '1 zona' : `${cajas.length} zonas`}`}
        </button>
        {cajas.length > 0 && (
          <button type="button" className="boton-secundario" onClick={() => setCajas((cs) => cs.slice(0, -1))} disabled={aplicando}>
            Deshacer última
          </button>
        )}
        <button type="button" className="boton-texto" onClick={onCancelar} disabled={aplicando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
