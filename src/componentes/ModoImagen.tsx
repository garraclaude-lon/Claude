import { useEffect, useRef, useState } from 'react';
import { mensajeErrorIA, obtenerLectorClaude, type LectorIA, type PropuestaIA } from '../ia/lectorIA';
import { ACEPTA_ARCHIVOS, prepararArchivo, type ImagenPreparada } from '../imagen/preparar';
import type { DatosPaciente } from '../registro/paciente';
import type { Repositorio } from '../registro/registro';
import { Asistente } from './Asistente';
import { EncabezadoPaciente, FormularioPaciente } from './FormularioPaciente';
import { GuardarRegistro, nuevaSesion } from './GuardarRegistro';
import { VisorECG } from './VisorECG';

interface Props {
  onSalir: () => void;
  repositorio?: Repositorio | null;
  /** Inyectables para pruebas. */
  obtenerLector?: () => Promise<LectorIA | null>;
  preparar?: (f: File) => Promise<ImagenPreparada>;
}

type Fase = 'cargar' | 'procesando' | 'paciente' | 'lista' | 'leyendo' | 'revision';
type EstadoLector = 'comprobando' | 'disponible' | 'no_disponible';

export function ModoImagen({ onSalir, repositorio = null, obtenerLector = obtenerLectorClaude, preparar = prepararArchivo }: Props) {
  const [fase, setFase] = useState<Fase>('cargar');
  const [imagen, setImagen] = useState<ImagenPreparada | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lector, setLector] = useState<LectorIA | null>(null);
  const [estadoLector, setEstadoLector] = useState<EstadoLector>('comprobando');
  const [sinDatosPersonales, setSinDatosPersonales] = useState(false);
  const [propuesta, setPropuesta] = useState<PropuestaIA | null>(null);
  const [paciente, setPaciente] = useState<DatosPaciente | null>(null);
  const control = useRef<AbortController | null>(null);
  const sesion = useRef(nuevaSesion());

  useEffect(() => {
    let vivo = true;
    obtenerLector()
      .then((l) => {
        if (!vivo) return;
        setLector(l);
        setEstadoLector(l ? 'disponible' : 'no_disponible');
      })
      .catch(() => vivo && setEstadoLector('no_disponible'));
    return () => {
      vivo = false;
      control.current?.abort();
    };
  }, [obtenerLector]);

  // Libera la URL local de la imagen al cambiarla o al salir.
  useEffect(() => () => { if (imagen) URL.revokeObjectURL(imagen.url); }, [imagen]);

  const alElegir = async (archivos: FileList | null) => {
    const archivo = archivos?.[0];
    if (!archivo) return;
    setError(null);
    setPropuesta(null);
    setFase('procesando');
    try {
      setImagen(await preparar(archivo));
      setFase(paciente ? 'lista' : 'paciente');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el archivo.');
      setFase('cargar');
    }
  };

  const pedirIA = async () => {
    if (!lector || !imagen) return;
    const ctl = new AbortController();
    control.current = ctl;
    setError(null);
    setFase('leyendo');
    try {
      const p = await lector.leer(imagen.blob, ctl.signal);
      setPropuesta(p);
      setFase('revision');
    } catch (e) {
      setError(mensajeErrorIA(e));
      setFase('lista');
    }
  };

  const cambiarImagen = () => {
    setImagen(null);
    setPropuesta(null);
    setSinDatosPersonales(false);
    setError(null);
    setFase('cargar');
  };

  if (fase === 'revision' && imagen && paciente) {
    return (
      <Asistente
        propuesta={propuesta}
        imagen={{ url: imagen.url, nombre: imagen.nombre }}
        encabezado={<EncabezadoPaciente datos={paciente} onCambiar={setPaciente} />}
        alTerminar={({ resultado, confirmadas, revisados }) => (
          <GuardarRegistro
            sesion={sesion}
            datos={{ modo: 'imagen', paciente, criterios: confirmadas, resultado, propuesta, revisados }}
            paciente={paciente}
            repositorio={repositorio}
            onOtroPaciente={onSalir}
          />
        )}
        onSalir={onSalir}
      />
    );
  }

  return (
    <section className="modo-imagen" aria-labelledby="titulo-modo-imagen">
      <h2 id="titulo-modo-imagen">ECG desde una foto o un archivo</h2>

      <p className="aviso-privacidad" role="note">
        <strong>Antes de cargar:</strong> asegurate de que la imagen no muestre el nombre, el documento ni
        otros datos que identifiquen al paciente. Recortá o tapá esa zona. La imagen no se guarda.
      </p>

      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}

      {(fase === 'cargar' || fase === 'procesando') && (
        <div className="carga">
          <label className="boton-carga">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => alElegir(e.target.files)}
              disabled={fase === 'procesando'}
              data-testid="input-camara"
            />
            <span className="boton-carga-titulo">Tomar foto</span>
            <span className="boton-carga-desc">Abre la cámara en el celular o la tablet</span>
          </label>
          <label className="boton-carga">
            <input
              type="file"
              accept={ACEPTA_ARCHIVOS}
              onChange={(e) => alElegir(e.target.files)}
              disabled={fase === 'procesando'}
              data-testid="input-archivo"
            />
            <span className="boton-carga-titulo">Subir archivo</span>
            <span className="boton-carga-desc">JPG, PNG, BMP o PDF (se usa la primera página)</span>
          </label>
          {fase === 'procesando' && <p role="status">Abriendo el archivo…</p>}
        </div>
      )}

      {fase === 'paciente' && imagen && (
        <div className="imagen-lista">
          <VisorECG url={imagen.url} nombre={imagen.nombre} />
          {imagen.nota && <p className="nota">{imagen.nota}</p>}
          <FormularioPaciente
            onConfirmar={(d) => {
              setPaciente(d);
              setFase('lista');
            }}
          />
        </div>
      )}

      {(fase === 'lista' || fase === 'leyendo') && imagen && paciente && (
        <div className="imagen-lista">
          <EncabezadoPaciente datos={paciente} onCambiar={setPaciente} />
          <VisorECG url={imagen.url} nombre={imagen.nombre} />
          {imagen.nota && <p className="nota">{imagen.nota}</p>}

          <div className="bloque-ia">
            <h3>Lectura automática (experimental)</h3>
            {estadoLector === 'comprobando' && <p role="status">Comprobando si la lectura automática está disponible…</p>}
            {estadoLector === 'no_disponible' && (
              <p className="nota" data-testid="ia-no-disponible">
                La lectura automática solo funciona en la versión publicada en claude.ai, con tu
                autorización. Podés seguir con la revisión guiada.
              </p>
            )}
            {estadoLector === 'disponible' && (
              <>
                <p className="nota">
                  Claude propone qué ve en cada derivación. Es una ayuda sin validar: después vas a
                  revisar y confirmar cada dato. La imagen se envía a Claude con tu cuenta y consume tu uso.
                </p>
                <label className="casilla">
                  <input
                    type="checkbox"
                    checked={sinDatosPersonales}
                    onChange={(e) => setSinDatosPersonales(e.target.checked)}
                    disabled={fase === 'leyendo'}
                  />
                  Confirmo que la imagen no contiene datos identificables del paciente.
                </label>
                {fase === 'leyendo' ? (
                  <div className="leyendo" role="status">
                    <span>Analizando la imagen… puede tardar hasta un minuto.</span>
                    <button type="button" className="boton-secundario" onClick={() => control.current?.abort()}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button type="button" className="boton-primario" disabled={!sinDatosPersonales} onClick={pedirIA}>
                    Pedir propuesta a la IA
                  </button>
                )}
              </>
            )}
          </div>

          <div className="acciones">
            <button
              type="button"
              className={estadoLector === 'disponible' ? 'boton-secundario' : 'boton-primario'}
              onClick={() => setFase('revision')}
              disabled={fase === 'leyendo'}
            >
              Revisar sin IA
            </button>
            <button type="button" className="boton-secundario" onClick={cambiarImagen} disabled={fase === 'leyendo'}>
              Cambiar imagen
            </button>
          </div>
        </div>
      )}

      <div className="acciones">
        <button type="button" className="boton-texto" onClick={onSalir}>
          Volver al inicio
        </button>
      </div>
    </section>
  );
}
