import { useState, type ReactNode } from 'react';
import { aplicarArruda, ENTRADA_VACIA } from '../algoritmo/arruda';
import { NOMBRES_ALGORITMO, NOMBRES_CAMPOS, NOMBRES_VALORES } from '../algoritmo/catalogo';
import { aplicarEasyWPW } from '../algoritmo/easywpw';
import { aplicarSmartWPW, textoHorasSector } from '../algoritmo/smartwpw';
import type { CampoECG, EntradaECG, PasoTraza, ResultadoAlgoritmo } from '../algoritmo/tipos';
import type { PropuestaIA } from '../ia/lectorIA';
import { CAMPOS } from './campos';
import { LOCALIZACIONES_EEF } from '../registro/eef';
import { PanelResultado } from './PanelResultado';
import { VisorECG } from './VisorECG';

interface Props {
  propuesta?: PropuestaIA | null;
  imagen?: { url: string; nombre: string } | null;
  /** Texto breve sobre el paciente, arriba de las preguntas. */
  encabezado?: ReactNode;
  /** Lo que se muestra debajo del resultado (p. ej., guardar en el registro). */
  alTerminar?: (d: {
    resultado: ResultadoAlgoritmo;
    confirmadas: EntradaECG;
    revisados: CampoECG[];
    /** Resultados de los algoritmos de comparación sobre el mismo ECG. */
    comparaciones?: ResultadoAlgoritmo[];
  }) => ReactNode;
  onSalir: () => void;
  /**
   * 'arruda': cuestionario guiado de Arruda.
   * 'smart_easy_arruda': SMART-WPW como algoritmo principal y EASY-WPW y Arruda como
   * comparación, sobre los mismos datos confirmados.
   */
  modo?: 'arruda' | 'smart_easy_arruda';
}

/**
 * Asistente guiado: hace una pregunta por vez, en el orden del algoritmo.
 * La siguiente pregunta es siempre el primer dato que el algoritmo declara
 * faltante, así solo se piden los datos de la rama que se está recorriendo.
 * Las propuestas de la IA se muestran como sugerencia y nunca se usan sin
 * confirmación explícita.
 */
export function Asistente({ propuesta, imagen, encabezado, alTerminar, onSalir, modo = 'arruda' }: Props) {
  const [confirmadas, setConfirmadas] = useState<EntradaECG>(ENTRADA_VACIA);
  const [historial, setHistorial] = useState<CampoECG[]>([]);

  const combinado = modo === 'smart_easy_arruda';
  // Algoritmos en el orden en que se completan: el principal primero.
  const secuencia: ResultadoAlgoritmo[] = combinado
    ? [aplicarSmartWPW(confirmadas), aplicarEasyWPW(confirmadas), aplicarArruda(confirmadas)]
    : [aplicarArruda(confirmadas)];
  const faltaDe = (r: ResultadoAlgoritmo) => (r.estado === 'datos_insuficientes' ? r.datosFaltantes[0] : null);
  const indiceEnCurso = secuencia.findIndex((r) => faltaDe(r) !== null);
  const pendiente: CampoECG | null = indiceEnCurso >= 0 ? faltaDe(secuencia[indiceEnCurso]) : null;
  const resultado: ResultadoAlgoritmo = secuencia[0];
  const comparaciones = secuencia.slice(1);
  /** Algoritmo al que corresponde la pregunta actual (o el principal, al terminar). */
  const enCurso: ResultadoAlgoritmo = indiceEnCurso >= 0 ? secuencia[indiceEnCurso] : resultado;

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

  const pasosRecorridos = enCurso.ruta.filter((p) => p.desenlace === 'continua');
  const nombreEnCurso = NOMBRES_ALGORITMO[enCurso.algoritmo ?? 'arruda'];

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

        {combinado && pendiente && (
          <p className="fase-algoritmo" data-testid="fase-algoritmo">
            {enCurso !== resultado ? (
              <>Comparación: <strong>{nombreEnCurso}</strong> (mismo ECG)</>
            ) : (
              <>Algoritmo principal: <strong>{nombreEnCurso}</strong></>
            )}
          </p>
        )}
        <Pasos ruta={enCurso.ruta} terminado={!pendiente} nombres={enCurso.nombresPasos} />

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
            pasoActual={enCurso.ruta[enCurso.ruta.length - 1].titulo}
            sugerido={propuesta?.valores[pendiente] ?? null}
            comentario={propuesta?.comentarios[pendiente]}
            onResponder={(v) => responder(pendiente, v)}
          />
        ) : (
          <>
            <PanelResultado
              resultado={resultado}
              desactualizado={false}
              onReiniciar={reiniciar}
              titulo={combinado ? `Resultado — ${NOMBRES_ALGORITMO.smart_wpw}` : undefined}
            />
            {combinado && <ComparacionAlgoritmos principal={resultado} comparaciones={comparaciones} />}
            {propuesta && <Concordancia propuesta={propuesta} confirmadas={confirmadas} campos={historial} />}
            {alTerminar?.({ resultado, confirmadas, revisados: historial, comparaciones: combinado ? comparaciones : undefined })}
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
        {def.ayuda}
        {/^delta(?!MasPositiva)/.test(campo) && ' Una onda que comienza isoeléctrica y luego se negativiza no debe marcarse como negativa.'}
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

/** Texto de la localización de un algoritmo: sector horario si lo da, si no las regiones. */
function localizacion(r: ResultadoAlgoritmo): string {
  if (r.sector) return `${textoHorasSector(r.sector)} · ${r.regiones.map((x) => x.abreviatura).join(' o ')}`;
  return r.regiones.length ? r.regiones.map((x) => x.abreviatura).join(' o ') : 'sin localización';
}

/** ¿Dos resultados señalan la misma zona? (algún sitio del EEF es compatible con ambos). */
function mismaZona(a: ResultadoAlgoritmo, b: ResultadoAlgoritmo): boolean | null {
  if (!a.regiones.length || !b.regiones.length) return null;
  return LOCALIZACIONES_EEF.some(
    (l) => a.regiones.some((x) => l.compatibles.includes(x.codigo)) && b.regiones.some((x) => l.compatibles.includes(x.codigo)),
  );
}

/** Resultados de los algoritmos de comparación sobre el mismo ECG, con su detalle desplegable. */
function ComparacionAlgoritmos({ principal, comparaciones }: { principal: ResultadoAlgoritmo; comparaciones: ResultadoAlgoritmo[] }) {
  const nombre = (r: ResultadoAlgoritmo) => NOMBRES_ALGORITMO[r.algoritmo ?? 'arruda'];
  return (
    <section className="comparacion-algoritmos" aria-labelledby="titulo-comparacion" data-testid="comparacion-algoritmos">
      <h3 id="titulo-comparacion">Comparación con otros algoritmos (mismo ECG)</h3>
      <table className="criterios">
        <thead>
          <tr>
            <th scope="col">Algoritmo</th>
            <th scope="col">Localización</th>
            <th scope="col">¿Misma zona que el principal?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{nombre(principal)} (principal)</td>
            <td>{localizacion(principal)}</td>
            <td>—</td>
          </tr>
          {comparaciones.map((c) => {
            const m = mismaZona(principal, c);
            return (
              <tr key={c.algoritmo} data-testid={`comparacion-${c.algoritmo}`}>
                <td>{nombre(c)}</td>
                <td>{localizacion(c)}</td>
                <td>{m === null ? 'sin localización' : m ? 'Sí' : 'No'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="nota">El estudio electrofisiológico dirá cuál acertó. Se guardan las tres predicciones.</p>
      {comparaciones.map((c) => (
        <details key={c.algoritmo} className="detalle-comparacion">
          <summary>Ver el recorrido de {nombre(c)}</summary>
          <PanelResultado resultado={c} desactualizado={false} onReiniciar={() => {}} titulo={`Resultado — ${nombre(c)}`} sinAcciones />
        </details>
      ))}
    </section>
  );
}

const NOMBRES_PASOS = ['Pared libre izquierda', 'PS subepicárdica', 'Septal', 'Pared libre derecha'];

/** Indicador de los pasos del algoritmo: recorridos, actual, final u omitidos. */
function Pasos({ ruta, terminado, nombres = NOMBRES_PASOS }: { ruta: PasoTraza[]; terminado: boolean; nombres?: string[] }) {
  const ultimo = ruta.length;
  const desenlace = ruta[ultimo - 1]?.desenlace;
  return (
    <ol className="pasos" aria-label="Pasos del algoritmo">
      {nombres.map((nombre, i) => {
        const n = i + 1;
        const estado =
          n < ultimo ? 'hecho' : n === ultimo ? (!terminado ? 'actual' : desenlace === 'clasifica' ? 'final' : 'detenido') : terminado ? 'omitido' : 'futuro';
        const textoEstado = { hecho: 'no se cumple, continúa', actual: 'en curso', final: 'define la región', detenido: 'se detiene', omitido: 'no se evalúa', futuro: 'pendiente' }[estado];
        return (
          <li key={n} className={`paso-indicador paso-${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
            <span className="paso-num" aria-hidden="true">{n}</span>
            <span className="paso-nombre">{nombre}</span>
            <span className="solo-lector">: {textoEstado}</span>
          </li>
        );
      })}
    </ol>
  );
}
