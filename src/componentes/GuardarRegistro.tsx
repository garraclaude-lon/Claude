import { useState, type MutableRefObject } from 'react';
import {
  construirEEF,
  generarCodigo,
  type CodigoEEF,
  type FuenteEEF,
} from '../registro/eef';
import { describirPaciente, type DatosPaciente } from '../registro/paciente';
import {
  construirRegistro,
  mensajeErrorRegistro,
  prediccionesDeResultados,
  type DatosParaRegistro,
  type Repositorio,
} from '../registro/registro';
import { concordanciasPorAlgoritmo } from './CargarEEF';
import { SelectorEEF } from './SelectorEEF';

/**
 * Estado del guardado que sobrevive aunque este componente se desmonte
 * (p. ej., al volver "Atrás"): el código del registro, lo último guardado y
 * la localización del EEF elegida.
 */
export interface SesionRegistro {
  codigo: string;
  guardadoJson: string | null;
  eef: CodigoEEF | null;
  fuente: FuenteEEF | null;
}

export const nuevaSesion = (): SesionRegistro => ({ codigo: generarCodigo(), guardadoJson: null, eef: null, fuente: null });

interface Props {
  /** Creada una vez por paciente analizado, en el componente padre (useRef). */
  sesion: MutableRefObject<SesionRegistro>;
  datos: Omit<DatosParaRegistro, 'codigo' | 'eef'>;
  paciente: DatosPaciente;
  repositorio: Repositorio | null;
  onOtroPaciente: () => void;
}

type Estado = 'listo' | 'guardando' | 'error';

/**
 * Guarda el análisis en el registro anónimo. Corregir un dato después de
 * guardar actualiza el mismo registro (mismo código) en lugar de crear otro.
 */
export function GuardarRegistro({ sesion, datos, paciente, repositorio, onOtroPaciente }: Props) {
  const [eef, setEefEstado] = useState<CodigoEEF | null>(sesion.current.eef);
  const [fuente, setFuenteEstado] = useState<FuenteEEF | null>(sesion.current.fuente);
  const [estado, setEstado] = useState<Estado>('listo');
  const [error, setError] = useState<string | null>(null);

  const setEef = (v: CodigoEEF | null) => {
    sesion.current.eef = v;
    setEefEstado(v);
  };
  const setFuente = (v: FuenteEEF | null) => {
    sesion.current.fuente = v;
    setFuenteEstado(v);
  };

  const regiones = datos.resultado.regiones.map((r) => r.codigo);
  const preds = prediccionesDeResultados(datos.resultado, datos.comparacion);
  const regionesPorAlg = Object.fromEntries(Object.entries(preds).map(([a, p]) => [a, p.regiones]));
  const datosEEF = eef ? construirEEF(regiones, eef, fuente, regionesPorAlg) : null;
  const registro = construirRegistro({ ...datos, codigo: sesion.current.codigo, eef: datosEEF });
  const json = JSON.stringify(registro);
  const guardado = sesion.current.guardadoJson !== null;
  const alDia = sesion.current.guardadoJson === json;

  const guardar = async () => {
    if (!repositorio) return;
    setEstado('guardando');
    setError(null);
    try {
      await repositorio.guardar(registro);
      sesion.current.guardadoJson = json;
      setEstado('listo');
    } catch (e) {
      setError(mensajeErrorRegistro(e));
      setEstado('error');
    }
  };

  return (
    <section className="guardar-registro" aria-labelledby="titulo-guardar">
      <h3 id="titulo-guardar">Registro del análisis</h3>
      <p className="nota">
        Paciente: <strong>{describirPaciente(paciente)}</strong>. Se guardan los datos del paciente, los
        criterios y el resultado. La imagen no se guarda.
      </p>

      <SelectorEEF
        id="eef-guardar"
        valor={eef}
        fuente={fuente}
        onCambiar={setEef}
        onCambiarFuente={setFuente}
        concordancia={datosEEF?.concordancia ?? null}
        porAlgoritmo={concordanciasPorAlgoritmo(datosEEF)}
        horas={datosEEF?.distanciaHoras}
        textoPendiente="Pendiente: cargarlo después con el código"
      />

      {!repositorio ? (
        <p className="nota" data-testid="registro-no-disponible">
          El registro solo se guarda en la versión publicada en claude.ai.
        </p>
      ) : (
        <div className="acciones">
          {alDia ? (
            <p className="guardado" role="status" data-testid="registro-guardado">
              ✓ Guardado en el registro
            </p>
          ) : (
            <button type="button" className="boton-primario" onClick={guardar} disabled={estado === 'guardando'}>
              {estado === 'guardando' ? 'Guardando…' : guardado ? 'Guardar cambios' : 'Guardar en el registro'}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}

      {guardado && <CodigoRegistro codigo={sesion.current.codigo} pendiente={!datosEEF} />}

      <div className="acciones">
        <button type="button" className="boton-secundario" onClick={onOtroPaciente}>
          Analizar otro paciente
        </button>
      </div>
    </section>
  );
}

function CodigoRegistro({ codigo, pendiente }: { codigo: string; pendiente: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard?.writeText(codigo).then(
      () => setCopiado(true),
      () => setCopiado(false),
    );
  };
  return (
    <div className="codigo-registro">
      <p className="codigo-titulo">Código del registro</p>
      <p className="codigo-valor" data-testid="codigo-registro">
        <span>{codigo}</span>
        <button type="button" className="boton-texto" onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </p>
      <p className="nota">
        {pendiente
          ? 'Anotalo en la historia clínica. Cuando tengas el resultado del estudio electrofisiológico, cargalo desde la pantalla de inicio con este código.'
          : 'Anotalo en la historia clínica por si hace falta corregir este registro.'}
      </p>
    </div>
  );
}

