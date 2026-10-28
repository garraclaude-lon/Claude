import { useState, type MutableRefObject } from 'react';
import { describirPaciente, type DatosPaciente } from '../registro/paciente';
import { mensajeErrorRegistro, type RegistroAnalisis, type Repositorio } from '../registro/registro';

/** Estado del guardado que sobrevive aunque este componente se desmonte (p. ej., con "Atrás"). */
export interface SesionRegistro {
  id: string | null;
  json: string | null;
}

export const nuevaSesion = (): SesionRegistro => ({ id: null, json: null });

interface Props {
  /** Creada una vez por paciente analizado, en el componente padre (useRef). */
  sesion: MutableRefObject<SesionRegistro>;
  registro: RegistroAnalisis;
  paciente: DatosPaciente;
  repositorio: Repositorio | null;
  onOtroPaciente: () => void;
}

type Estado = 'sin_guardar' | 'guardando' | 'guardado' | 'error';

/**
 * Guarda el análisis en el registro anónimo. Si el resultado cambia después
 * de guardarlo (por ejemplo, con "Atrás"), se actualiza el mismo registro
 * en lugar de crear uno nuevo.
 */
export function GuardarRegistro({ sesion, registro, paciente, repositorio, onOtroPaciente }: Props) {
  const actualJson = JSON.stringify(registro);
  const [estado, setEstado] = useState<Estado>(sesion.current.json === actualJson ? 'guardado' : 'sin_guardar');
  const [error, setError] = useState<string | null>(null);

  const hayCambios = sesion.current.id !== null && sesion.current.json !== actualJson;

  const guardar = async () => {
    if (!repositorio) return;
    setEstado('guardando');
    setError(null);
    try {
      sesion.current.id = await repositorio.guardar(sesion.current.id, registro);
      sesion.current.json = actualJson;
      setEstado('guardado');
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

      {!repositorio ? (
        <p className="nota" data-testid="registro-no-disponible">
          El registro solo se guarda en la versión publicada en claude.ai.
        </p>
      ) : (
        <div className="acciones">
          {estado === 'guardado' && !hayCambios ? (
            <p className="guardado" role="status" data-testid="registro-guardado">
              ✓ Guardado en el registro
            </p>
          ) : (
            <button type="button" className="boton-primario" onClick={guardar} disabled={estado === 'guardando'}>
              {estado === 'guardando' ? 'Guardando…' : hayCambios ? 'Guardar cambios' : 'Guardar en el registro'}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}

      <div className="acciones">
        <button type="button" className="boton-secundario" onClick={onOtroPaciente}>
          Analizar otro paciente
        </button>
      </div>
    </section>
  );
}
