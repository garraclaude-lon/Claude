import { useState } from 'react';
import { NOMBRES_ALGORITMO, REGIONES } from '../algoritmo/catalogo';
import type { CodigoAlgoritmo, CodigoRegion } from '../algoritmo/tipos';
import { construirEEF, normalizarCodigo, type CodigoEEF, type Concordancia, type DatosEEF, type FuenteEEF } from '../registro/eef';
import { NOMBRES_GRUPO, NOMBRES_SEXO } from '../registro/paciente';
import { mensajeErrorRegistro, prediccionesDe, type Prediccion, type RegistroGuardado, type Repositorio } from '../registro/registro';
import { DiagramaAnillos } from './DiagramaAnillos';
import { SelectorEEF } from './SelectorEEF';

export function nombreRegiones(codigos: readonly string[] | undefined): string {
  if (!codigos || codigos.length === 0) return 'Sin región';
  return codigos.map((c) => REGIONES[c as CodigoRegion]?.abreviatura ?? c).join(' o ');
}

/** Orden en que se muestran los algoritmos: el principal de "Subir ECG" primero. */
const ORDEN_ALGORITMOS: CodigoAlgoritmo[] = ['easy_wpw', 'arruda'];

/** Predicción de cada algoritmo en texto: "EASY-WPW: PST · Arruda: PST o PSM". */
export function textoPredicciones(preds: Partial<Record<CodigoAlgoritmo, Prediccion>>): string {
  const algs = ORDEN_ALGORITMOS.filter((a) => preds[a]);
  if (algs.length <= 1) return nombreRegiones(algs[0] ? preds[algs[0]]!.regiones : undefined);
  return algs.map((a) => `${NOMBRES_ALGORITMO[a].split(' ')[0]}: ${nombreRegiones(preds[a]!.regiones)}`).join(' · ');
}

/** Concordancia de cada algoritmo, para mostrar debajo del selector del EEF. */
export function concordanciasPorAlgoritmo(eef: DatosEEF | null): { nombre: string; concordancia: Concordancia }[] | undefined {
  if (!eef?.concordancias) return undefined;
  return ORDEN_ALGORITMOS.filter((a) => eef.concordancias![a]).map((a) => ({
    nombre: NOMBRES_ALGORITMO[a].split(' ')[0],
    concordancia: eef.concordancias![a]!,
    horas: eef.distancias?.[a],
  }));
}

export function fechaCorta(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function pacienteCorto(r: RegistroGuardado): string {
  const p = r.paciente;
  if (!p) return '—';
  const edad = p.edadAnios === 0 ? `${p.edadMeses} m` : `${p.edadAnios} a ${p.edadMeses} m`;
  return `${NOMBRES_SEXO[p.sexo] ?? p.sexo}, ${edad} (${NOMBRES_GRUPO[p.grupoEtario]?.split(' ')[0] ?? p.grupoEtario})`;
}

interface PropsEditor {
  registro: RegistroGuardado;
  repositorio: Repositorio;
  onCerrar: () => void;
}

/** Carga o corrige el resultado del EEF de un análisis ya guardado. */
export function EditorEEF({ registro, repositorio, onCerrar }: PropsEditor) {
  const [eef, setEef] = useState<CodigoEEF | null>(registro.eef?.localizacion ?? null);
  const [fuente, setFuente] = useState<FuenteEEF | null>(registro.eef?.fuente ?? null);
  const [estado, setEstado] = useState<'listo' | 'guardando' | 'guardado'>('listo');
  const [error, setError] = useState<string | null>(null);

  const regiones = registro.resultado?.regiones ?? [];
  const preds = prediccionesDe(registro);
  const regionesPorAlg = Object.fromEntries(Object.entries(preds).map(([a, p]) => [a, p.regiones]));
  const datosEEF = eef ? construirEEF(regiones, eef, fuente, registro.predicciones ? regionesPorAlg : undefined) : null;

  const guardar = async () => {
    setEstado('guardando');
    setError(null);
    try {
      await repositorio.actualizarEEF(registro.codigo, datosEEF);
      setEstado('guardado');
    } catch (e) {
      setError(mensajeErrorRegistro(e));
      setEstado('listo');
    }
  };

  return (
    <div className="editor-eef" role="group" aria-label={`Resultado del EEF para ${registro.codigo}`}>
      <p className="editor-eef-cabecera">
        <strong>{registro.codigo}</strong> · {pacienteCorto(registro)} · analizado el {fechaCorta(registro.creadoEn)} ·
        predicción: <strong>{textoPredicciones(preds)}</strong>
      </p>
      <SelectorEEF
        id={`eef-${registro.codigo}`}
        valor={eef}
        fuente={fuente}
        onCambiar={(v) => {
          setEef(v);
          setEstado('listo');
        }}
        onCambiarFuente={(v) => {
          setFuente(v);
          setEstado('listo');
        }}
        concordancia={datosEEF?.concordancia ?? null}
        porAlgoritmo={concordanciasPorAlgoritmo(datosEEF)}
        horas={datosEEF?.distanciaHoras}
        textoPendiente="Pendiente (sin resultado todavía)"
      />
      <DiagramaAnillos predichas={regiones} confirmado={eef} titulo="Predicción y sitio confirmado" />
      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}
      <div className="acciones">
        {estado === 'guardado' ? (
          <p className="guardado" role="status" data-testid="eef-guardado">
            ✓ Resultado del EEF guardado
          </p>
        ) : (
          <button type="button" className="boton-primario" onClick={guardar} disabled={estado === 'guardando'}>
            {estado === 'guardando' ? 'Guardando…' : 'Guardar resultado del EEF'}
          </button>
        )}
        <button type="button" className="boton-secundario" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

/** Buscar un análisis por su código para cargar o corregir el EEF. */
export function BuscarPorCodigo({ repositorio, onEncontrado }: { repositorio: Repositorio; onEncontrado: (r: RegistroGuardado) => void }) {
  const [texto, setTexto] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = async () => {
    const codigo = normalizarCodigo(texto);
    if (!codigo) {
      setMensaje('El código tiene la forma WPW-XXXXXX (6 letras o números).');
      return;
    }
    setBuscando(true);
    setMensaje(null);
    try {
      const r = await repositorio.obtener(codigo);
      if (r) {
        onEncontrado({ ...r, codigo });
        setTexto('');
      } else setMensaje(`No hay ningún análisis con el código ${codigo}.`);
    } catch (e) {
      setMensaje(mensajeErrorRegistro(e));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <form
      className="buscar-codigo"
      onSubmit={(e) => {
        e.preventDefault();
        void buscar();
      }}
    >
      <label htmlFor="buscar-codigo">Buscar por código</label>
      <div className="buscar-codigo-fila">
        <input
          id="buscar-codigo"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="WPW-XXXXXX"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="boton-secundario" disabled={buscando}>
          Buscar
        </button>
      </div>
      {mensaje && <p className="error-campo" role="alert">{mensaje}</p>}
    </form>
  );
}
