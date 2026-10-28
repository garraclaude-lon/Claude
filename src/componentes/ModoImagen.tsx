import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  mensajeErrorIA,
  obtenerLectorClaude,
  type DeteccionPrivacidad,
  type LectorIA,
  type PropuestaIA,
} from '../ia/lectorIA';
import { calcularRecorte, EDITOR_NAVEGADOR, type Caja, type EditorImagen } from '../imagen/anonimizar';
import { ACEPTA_ARCHIVOS, prepararArchivo, type ImagenPreparada } from '../imagen/preparar';
import type { DatosPaciente } from '../registro/paciente';
import type { Repositorio } from '../registro/registro';
import { AlertaPrivacidad } from './AlertaPrivacidad';
import { Asistente } from './Asistente';
import { EncabezadoPaciente, FormularioPaciente } from './FormularioPaciente';
import { GuardarRegistro, nuevaSesion } from './GuardarRegistro';
import { IconoArchivo, IconoCamara } from './Iconos';
import { TaparZonas } from './TaparZonas';
import { VisorECG } from './VisorECG';

interface Props {
  onSalir: () => void;
  repositorio?: Repositorio | null;
  /** Inyectables para pruebas. */
  obtenerLector?: () => Promise<LectorIA | null>;
  preparar?: (f: File) => Promise<ImagenPreparada>;
  editor?: EditorImagen;
}

/**
 * Estado de la revisión de datos personales en la imagen:
 * - sin_revisar / revisando: todavía no terminó la revisión automática.
 * - limpia: la IA no encontró datos personales.
 * - anonimizada: se ocultaron o recortaron zonas.
 * - no_verificada: la revisión automática falló.
 * - no_disponible: no hay IA (fuera de claude.ai); hay que revisar a mano.
 */
type EstadoPrivacidad = 'sin_revisar' | 'revisando' | 'limpia' | 'anonimizada' | 'no_verificada' | 'no_disponible';

type Fase = 'cargar' | 'procesando' | 'paciente' | 'lista' | 'leyendo' | 'revision';
type EstadoLector = 'comprobando' | 'disponible' | 'no_disponible';

export function ModoImagen({
  onSalir,
  repositorio = null,
  obtenerLector = obtenerLectorClaude,
  preparar = prepararArchivo,
  editor = EDITOR_NAVEGADOR,
}: Props) {
  const [fase, setFase] = useState<Fase>('cargar');
  const [imagen, setImagen] = useState<ImagenPreparada | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lector, setLector] = useState<LectorIA | null>(null);
  const [estadoLector, setEstadoLector] = useState<EstadoLector>('comprobando');
  /** Ventana que frena el avance porque se detectaron datos personales. */
  const [bloqueado, setBloqueado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  /** Última versión de la imagen que la revisión dio por limpia. */
  const imagenLimpia = useRef<Blob | null>(null);
  const [propuesta, setPropuesta] = useState<PropuestaIA | null>(null);
  const [paciente, setPaciente] = useState<DatosPaciente | null>(null);
  const control = useRef<AbortController | null>(null);
  const sesion = useRef(nuevaSesion());
  const [privacidad, setPrivacidad] = useState<EstadoPrivacidad>('sin_revisar');
  const [deteccion, setDeteccion] = useState<DeteccionPrivacidad | null>(null);
  const [anonimizacion, setAnonimizacion] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [tapando, setTapando] = useState(false);

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

  // Revisión automática de datos personales, apenas hay imagen y se sabe si hay IA.
  const imagenRevisada = useRef<Blob | null>(null);
  useEffect(() => {
    if (!imagen || privacidad !== 'sin_revisar' || estadoLector === 'comprobando') return;
    if (!lector?.detectarDatosPersonales) {
      setPrivacidad('no_disponible');
      return;
    }
    if (imagenRevisada.current === imagen.blob) return;
    imagenRevisada.current = imagen.blob;
    const ctl = new AbortController();
    control.current = ctl;
    setPrivacidad('revisando');
    lector
      .detectarDatosPersonales(imagen.blob, ctl.signal)
      .then((d) => {
        if (ctl.signal.aborted) return;
        if (d.hayDatosPersonales && d.zonas.length > 0) {
          setDeteccion(d);
        } else if (d.hayDatosPersonales) {
          // Dijo que hay datos pero no supo ubicarlos: se pide taparlos a mano.
          setPrivacidad('no_verificada');
          setTapando(true);
        } else {
          imagenLimpia.current = imagen.blob;
          setPrivacidad('limpia');
        }
      })
      .catch((e) => {
        if (ctl.signal.aborted && (e as { code?: string })?.code === 'cancelled') return;
        setPrivacidad('no_verificada');
      });
  }, [imagen, privacidad, estadoLector, lector]);

  // Mientras está la alerta, el resto de la página no se puede usar.
  useEffect(() => {
    const raiz = document.getElementById('root');
    if (!raiz || !deteccion) return;
    raiz.setAttribute('inert', '');
    return () => raiz.removeAttribute('inert');
  }, [deteccion]);

  const reemplazarImagen = (blob: Blob) => {
    // El nombre del archivo también puede tener el nombre del paciente.
    setImagen((prev) => (prev ? { ...prev, blob, url: URL.createObjectURL(blob), nombre: 'ECG anonimizado' } : prev));
  };

  const anonimizar = async (accion: 'ocultar' | 'recortar', cajas: Caja[]) => {
    if (!imagen) return;
    setAplicando(true);
    setError(null);
    try {
      const recorte = accion === 'recortar' ? calcularRecorte(cajas) : null;
      const nueva = recorte ? await editor.recortar(imagen.blob, recorte) : await editor.ocultar(imagen.blob, cajas);
      imagenRevisada.current = nueva;
      reemplazarImagen(nueva);
      setAnonimizacion((prev) => {
        const ahora = recorte
          ? 'se recortó la franja con datos personales'
          : `se ${cajas.length === 1 ? 'ocultó 1 zona' : `ocultaron ${cajas.length} zonas`}`;
        return prev ? `${prev}; ${ahora}` : ahora;
      });
      setPrivacidad('anonimizada');
      setDeteccion(null);
      setTapando(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anonimizar la imagen.');
    } finally {
      setAplicando(false);
    }
  };

  const revisionPendiente = privacidad === 'sin_revisar' || privacidad === 'revisando' || deteccion !== null;

  const alElegir = async (archivos: FileList | null) => {
    const archivo = archivos?.[0];
    if (!archivo) return;
    setError(null);
    setPropuesta(null);
    setPrivacidad('sin_revisar');
    setDeteccion(null);
    setAnonimizacion(null);
    setTapando(false);
    setFase('procesando');
    try {
      setImagen(await preparar(archivo));
      setFase(paciente ? 'lista' : 'paciente');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el archivo.');
      setFase('cargar');
    }
  };

  /**
   * Antes de pasar al siguiente paso se vuelve a revisar la imagen (salvo que esta
   * misma versión ya haya dado limpia). Si todavía se ve un nombre o apellido, no se avanza.
   */
  const verificarYSeguir = async (siguiente: () => void) => {
    if (!imagen) return;
    if (!lector?.detectarDatosPersonales || imagenLimpia.current === imagen.blob) return siguiente();
    const ctl = new AbortController();
    control.current = ctl;
    setVerificando(true);
    try {
      const d = await lector.detectarDatosPersonales(imagen.blob, ctl.signal);
      if (ctl.signal.aborted) return;
      // Solo frena si ve un nombre o un apellido del paciente.
      if (d.zonas.some((z) => z.tipo === 'nombre' || z.tipo === 'apellido')) {
        setBloqueado(true);
        return;
      }
      if (!d.hayDatosPersonales) imagenLimpia.current = imagen.blob;
    } catch (e) {
      if (ctl.signal.aborted) return;
      // Si la revisión no responde, se sigue: el aviso pide revisar y tapar a mano.
    } finally {
      setVerificando(false);
    }
    siguiente();
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

  const imagenYPrivacidad = imagen && (
    <>
      {tapando ? (
        <TaparZonas
          url={imagen.url}
          nombre={imagen.nombre}
          aplicando={aplicando}
          onAplicar={(cajas) => anonimizar('ocultar', cajas)}
          onCancelar={() => setTapando(false)}
        />
      ) : (
        <VisorECG url={imagen.url} nombre={imagen.nombre} />
      )}
      {imagen.nota && <p className="nota">{imagen.nota}</p>}
      <EstadoPrivacidad estado={deteccion ? 'detectada' : privacidad} detalle={anonimizacion} />
      {!tapando && !revisionPendiente && (
        <button type="button" className="boton-volumen boton-tapar" onClick={() => setTapando(true)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <rect x="6" y="8" width="7" height="4" rx="1" fill="currentColor" />
          </svg>
          Tapar una zona a mano
        </button>
      )}
      {bloqueado &&
        createPortal(
          <BloqueoDatosPersonales
            onTapar={() => {
              setBloqueado(false);
              setTapando(true);
            }}
            onCerrar={() => setBloqueado(false)}
          />,
          document.body,
        )}
      {deteccion &&
        createPortal(
          <AlertaPrivacidad
            zonas={deteccion.zonas}
            recorte={calcularRecorte(deteccion.zonas)}
            aplicando={aplicando}
            onOcultar={() => anonimizar('ocultar', deteccion.zonas)}
            onRecortar={() => anonimizar('recortar', deteccion.zonas)}
          />,
          document.body,
        )}
    </>
  );

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
        <strong>Privacidad:</strong> al cargar la imagen, la app busca nombre, documento y otros datos del
        paciente, y los oculta o recorta antes de seguir. Igual revisala vos: la detección puede fallar.
        La imagen no se guarda.
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
            <IconoCamara className="boton-carga-icono" />
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
            <IconoArchivo className="boton-carga-icono" />
            <span className="boton-carga-titulo">Subir archivo</span>
            <span className="boton-carga-desc">JPG, PNG, BMP o PDF (se usa la primera página)</span>
          </label>
          {fase === 'procesando' && <p role="status">Abriendo el archivo…</p>}
        </div>
      )}

      {fase === 'paciente' && imagen && (
        <div className="imagen-lista">
          {imagenYPrivacidad}
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
          {imagenYPrivacidad}

          <div className="acciones-principales">
            {fase === 'leyendo' ? (
              <div className="leyendo" role="status">
                <span>Analizando la imagen… puede tardar hasta un minuto.</span>
                <button type="button" className="boton-volumen" onClick={() => control.current?.abort()}>
                  Cancelar
                </button>
              </div>
            ) : estadoLector === 'no_disponible' ? (
              // Sin IA (fuera de claude.ai) se sigue con la revisión guiada.
              <button
                type="button"
                className="boton-volumen boton-principal"
                data-testid="ia-no-disponible"
                onClick={() => verificarYSeguir(() => setFase('revision'))}
                disabled={deteccion !== null || tapando || verificando}
              >
                <IconoGuiado />
                Continuar sin IA
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="boton-volumen boton-principal"
                  disabled={estadoLector === 'comprobando' || revisionPendiente || tapando || verificando}
                  onClick={() => verificarYSeguir(pedirIA)}
                >
                  <IconoAnalizar />
                  {estadoLector === 'comprobando' ? 'Preparando…' : revisionPendiente || verificando ? 'Revisando la imagen…' : 'Analizar y localizar vía con IA'}
                </button>
                {/* Si la IA falla, queda la opción de seguir con la revisión guiada. */}
                {error && (
                  <button
                    type="button"
                    className="boton-volumen"
                    onClick={() => verificarYSeguir(() => setFase('revision'))}
                    disabled={deteccion !== null || tapando || verificando}
                  >
                    Continuar sin IA
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="acciones">
        <button type="button" className="boton-volumen" onClick={onSalir}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver al inicio
        </button>
      </div>
    </section>
  );
}

const TEXTO_PRIVACIDAD: Record<EstadoPrivacidad | 'detectada', { clase: string; texto: string } | null> = {
  sin_revisar: null,
  detectada: { clase: 'peligro', texto: 'Se detectaron datos personales: hay que anonimizar la imagen antes de seguir.' },
  revisando: { clase: 'revisando', texto: 'Revisando si la imagen muestra datos personales…' },
  limpia: { clase: 'ok', texto: 'No se detectaron datos personales en la imagen.' },
  anonimizada: { clase: 'ok', texto: 'Imagen anonimizada' },
  no_verificada: {
    clase: 'aviso',
    texto: 'No se pudo confirmar automáticamente que la imagen esté libre de datos personales. Revisala y tapá a mano lo que haga falta.',
  },
  no_disponible: {
    clase: 'aviso',
    texto: 'La revisión automática de datos personales solo funciona en la versión publicada en claude.ai. Revisá la imagen y tapá a mano lo que haga falta.',
  },
};

function EstadoPrivacidad({ estado, detalle }: { estado: EstadoPrivacidad | 'detectada'; detalle: string | null }) {
  const t = TEXTO_PRIVACIDAD[estado];
  if (!t) return null;
  return (
    <p className={`estado-privacidad estado-privacidad-${t.clase}`} role="status" data-testid="estado-privacidad">
      {t.texto}
      {estado === 'anonimizada' && detalle ? `: ${detalle}.` : ''}
    </p>
  );
}

/** Ventana chica que impide seguir mientras la imagen tenga datos personales. */
function BloqueoDatosPersonales({ onTapar, onCerrar }: { onTapar: () => void; onCerrar: () => void }) {
  const primario = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primario.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alTeclear);
    const raiz = document.getElementById('root');
    raiz?.setAttribute('inert', '');
    return () => {
      window.removeEventListener('keydown', alTeclear);
      raiz?.removeAttribute('inert');
    };
  }, [onCerrar]);
  return (
    <div className="modal-fondo" data-testid="bloqueo-datos">
      <div className="modal-alerta modal-alerta-chica" role="alertdialog" aria-modal="true" aria-labelledby="bloqueo-datos-texto">
        <div className="modal-alerta-icono" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M5.6 5.6l12.8 12.8" />
          </svg>
        </div>
        <h2 id="bloqueo-datos-texto">No puedo continuar porque contiene datos personales del paciente.</h2>
        <div className="modal-alerta-acciones">
          <button ref={primario} type="button" className="boton-peligro" onClick={onTapar}>
            Tapar una zona a mano
          </button>
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function IconoAnalizar() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4l2-5 3 10 2-6 1.5 3H18" />
      <circle cx="19" cy="15" r="2.5" />
      <path d="M21 17l1.5 1.5" />
    </svg>
  );
}

function IconoGuiado() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
