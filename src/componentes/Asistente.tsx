import { useState, type ReactNode } from 'react';
import { aplicarArruda, ENTRADA_VACIA } from '../algoritmo/arruda';
import { NOMBRES_CAMPOS, NOMBRES_VALORES } from '../algoritmo/catalogo';
import type { CampoECG, EntradaECG, ResultadoArruda } from '../algoritmo/tipos';
import type { PropuestaIA } from '../ia/lectorIA';
import { CAMPOS } from './campos';
import { PanelResultado } from './PanelResultado';
import { VisorECG } from './VisorECG';

interface Props {
  propuesta?: PropuestaIA | null;
  imagen?: { url: string; nombre: string } | null;
  /** Texto breve sobre el paciente, arriba de las preguntas. */
  encabezado?: ReactNode;
  /** Lo que se muestra debajo del resultado (p. ej., guardar en el registro). */
  alTerminar?: (d: { resultado: ResultadoArruda; confirmadas: EntradaECG; revisados: CampoECG[] }) => ReactNode;
  onSalir: () => void;
}

/**
 * Asistente guiado: hace una pregunta por vez, en el orden del algoritmo.
 * La siguiente pregunta es siempre el primer dato que el algoritmo declara
 * faltante, así solo se piden los datos de la rama que se está recorriendo.
 * Las propuestas de la IA se muestran como sugerencia y nunca se usan sin
 * confirmación explícita.
 */
export function Asistente({ propuesta, imagen, encabezado, alTerminar, onSalir }: Props) {
  const [confirmadas, setConfirmadas] = useState<EntradaECG>(ENTRADA_VACIA);
  const [historial, setHistorial] = useState<CampoECG[]>([]);

  const resultado = aplicarArruda(confirmadas);
  const pendiente: CampoECG | null =
    resultado.estado === 'datos_insuficientes' ? resultado.datosFaltantes[0] : null;

  const responder = (campo: CampoECG, valor: string) => {
    setConfirmadas((prev) => ({ ...prev, [campo]: valor }));
    setHistorial((h) => [...h, campo]);
  };

  const atras = () => {
    const ultimo = historial[historial.length - 1];
    if (!ultimo) return;
    setConfirmadas((prev) => ({ ...prev, [ultimo]: null }));
    setHistorial((h) => h.slice(0, -1));
  };

  const reiniciar = () => {
    setConfirmadas(ENTRADA_VACIA);
    setHistorial([]);
  };

  const pasosRecorridos = resultado.ruta.filter((p) => p.desenlace === 'continua');

  return (
    <div className={`asistente${imagen ? ' con-imagen' : ''}`}>
      {imagen && (
        <div className="asistente-imagen">
          <VisorECG url={imagen.url} nombre={imagen.nombre} />
        </div>
      )}

      <div className="asistente-principal">
        {encabezado}
        {propuesta && (
          <div className="aviso-ia" role="note">
            <strong>Propuesta de la IA (experimental).</strong> La lectura automática no está validada.
            Cada valor sugerido aparece marcado; solo se usa si lo confirmás.
            {propuesta.calidad && <> Calidad de imagen informada: {propuesta.calidad}.</>}
            {propuesta.esECG === false && <> La IA indicó que la imagen podría no ser un ECG.</>}
            {propuesta.observacionGeneral && <span className="aviso-ia-obs"> “{propuesta.observacionGeneral}”</span>}
          </div>
        )}

        {pasosRecorridos.length > 0 && (
          <ol className="recorrido-parcial" aria-label="Recorrido hasta ahora">
            {pasosRecorridos.map((p) => (
              <li key={p.paso}>
                <span className="recorrido-titulo">{p.titulo}</span>
                <span className="recorrido-decision">{p.decision}</span>
              </li>
            ))}
          </ol>
        )}

        {pendiente ? (
          <Pregunta
            key={pendiente}
            campo={pendiente}
            numero={historial.length + 1}
            pasoActual={resultado.ruta[resultado.ruta.length - 1].titulo}
            sugerido={propuesta?.valores[pendiente] ?? null}
            comentario={propuesta?.comentarios[pendiente]}
            onResponder={(v) => responder(pendiente, v)}
          />
        ) : (
          <>
            <PanelResultado resultado={resultado} desactualizado={false} onReiniciar={reiniciar} />
            {propuesta && <Concordancia propuesta={propuesta} confirmadas={confirmadas} campos={historial} />}
            {alTerminar?.({ resultado, confirmadas, revisados: historial })}
          </>
        )}

        <div className="acciones">
          {historial.length > 0 && (
            <button type="button" className="boton-secundario" onClick={atras}>
              ← Atrás
            </button>
          )}
          {historial.length > 0 && pendiente && (
            <button type="button" className="boton-secundario" onClick={reiniciar}>
              Empezar de nuevo
            </button>
          )}
          <button type="button" className="boton-texto" onClick={onSalir}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

interface PropsPregunta {
  campo: CampoECG;
  numero: number;
  pasoActual: string;
  sugerido: string | null;
  comentario?: string;
  onResponder: (valor: string) => void;
}

function Pregunta({ campo, numero, pasoActual, sugerido, comentario, onResponder }: PropsPregunta) {
  const def = CAMPOS[campo];
  const idTitulo = `pregunta-${campo}`;
  return (
    <section className="pregunta" aria-labelledby={idTitulo} data-testid="pregunta">
      <p className="pregunta-contexto">
        Pregunta {numero} · {pasoActual}
      </p>
      <div className="pregunta-cabecera">
        <span className="pregunta-derivacion" aria-hidden="true">{def.derivacion}</span>
        <h2 id={idTitulo}>{def.pregunta}</h2>
      </div>
      <p className="ayuda">
        {def.ayuda} Una onda que comienza isoeléctrica y luego se negativiza no debe marcarse como negativa.
      </p>
      {sugerido && (
        <p className="sugerencia-ia">
          La IA sugiere: <strong>{NOMBRES_VALORES[sugerido]}</strong>
          {comentario && <> — {comentario}</>}
        </p>
      )}
      <div className="pregunta-opciones">
        {def.opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`opcion-grande${sugerido === o.valor ? ' sugerida' : ''}`}
            onClick={() => onResponder(o.valor)}
          >
            {o.etiqueta}
            {sugerido === o.valor && <span className="marca-ia">Sugerida por IA</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

interface PropsConcordancia {
  propuesta: PropuestaIA;
  confirmadas: EntradaECG;
  campos: CampoECG[];
}

/** Compara lo que propuso la IA con lo que confirmó el profesional. */
function Concordancia({ propuesta, confirmadas, campos }: PropsConcordancia) {
  const filas = campos.map((c) => {
    const ia = propuesta.valores[c];
    const conf = confirmadas[c];
    return { campo: c, ia, conf, coincide: ia !== null && ia === conf };
  });
  const coincidencias = filas.filter((f) => f.coincide).length;
  return (
    <section className="concordancia" aria-labelledby="titulo-concordancia">
      <h3 id="titulo-concordancia">Propuesta de la IA frente a tu revisión</h3>
      <p className="nota">
        Coincidencia en {coincidencias} de {filas.length} criterios revisados. Dato descriptivo para
        investigación; no es una medida de exactitud de la IA.
      </p>
      <table className="criterios">
        <thead>
          <tr>
            <th scope="col">Criterio</th>
            <th scope="col">IA</th>
            <th scope="col">Confirmado</th>
            <th scope="col">¿Coincide?</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.campo}>
              <td>{NOMBRES_CAMPOS[f.campo]}</td>
              <td>{f.ia ? NOMBRES_VALORES[f.ia] : 'sin propuesta'}</td>
              <td>{f.conf ? NOMBRES_VALORES[f.conf] : '—'}</td>
              <td>{f.coincide ? 'Sí' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
