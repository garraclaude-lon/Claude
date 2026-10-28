import { useEffect, useRef, useState } from 'react';
import { aplicarArruda, ENTRADA_VACIA } from './algoritmo/arruda';
import type { CampoECG, EntradaECG, ResultadoArruda } from './algoritmo/tipos';
import type { LectorIA } from './ia/lectorIA';
import type { ImagenPreparada } from './imagen/preparar';
import type { DatosPaciente } from './registro/paciente';
import { obtenerRepositorioClaude, type Repositorio } from './registro/registro';
import { EncabezadoPaciente, FormularioPaciente } from './componentes/FormularioPaciente';
import { GuardarRegistro, nuevaSesion } from './componentes/GuardarRegistro';
import { ResumenRegistro } from './componentes/ResumenRegistro';
import { Asistente } from './componentes/Asistente';
import { IconoAviso, Marca } from './componentes/Iconos';
import { FormularioECG } from './componentes/FormularioECG';
import { ModoImagen } from './componentes/ModoImagen';
import { PanelResultado } from './componentes/PanelResultado';
import { PantallaInicio } from './componentes/PantallaInicio';

type Modo = 'inicio' | 'imagen' | 'guiado' | 'formulario';

interface Props {
  /** Inyectables para pruebas del modo imagen. */
  obtenerLector?: () => Promise<LectorIA | null>;
  preparar?: (f: File) => Promise<ImagenPreparada>;
  obtenerRepositorio?: () => Promise<Repositorio | null>;
}

export function App({ obtenerLector, preparar, obtenerRepositorio = obtenerRepositorioClaude }: Props = {}) {
  const [modo, setModo] = useState<Modo>('inicio');
  const [repositorio, setRepositorio] = useState<Repositorio | null>(null);
  // Se conserva al pasar del cuestionario al formulario completo.
  const [paciente, setPaciente] = useState<DatosPaciente | null>(null);
  const irInicio = () => {
    setPaciente(null);
    setModo('inicio');
  };

  useEffect(() => {
    let vivo = true;
    obtenerRepositorio()
      .then((r) => vivo && setRepositorio(r))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [obtenerRepositorio]);

  return (
    <div className="app">
      <header className="encabezado">
        <button type="button" className="marca" onClick={irInicio} aria-label="Ir al inicio">
          <Marca className="marca-icono" />
        </button>
        <div className="encabezado-textos">
          <h1>
            WPW Navigator 3D <span className="by">by Longa</span>
          </h1>
          <p className="subtitulo">Localización de vías accesorias — Algoritmo de Arruda</p>
        </div>
      </header>

      <p className="aviso-investigacion" role="note">
        <IconoAviso className="aviso-icono" />
        <span>
          <strong>Prototipo de investigación.</strong> No reemplaza la evaluación clínica ni el estudio
          electrofisiológico; las reglas deben revisarse contra la publicación original antes de
          cualquier uso asistencial. No ingreses datos identificables. Solo se guardan datos anónimos
          (sexo, edad, criterios y resultado) al pulsar “Guardar en el registro”; la imagen nunca se
          guarda.
        </span>
      </p>

      <main>
        {modo === 'inicio' && (
          <>
            <PantallaInicio onElegir={setModo} />
            <ResumenRegistro repositorio={repositorio} />
          </>
        )}
        {modo === 'imagen' && (
          <ModoImagen onSalir={irInicio} repositorio={repositorio} obtenerLector={obtenerLector} preparar={preparar} />
        )}
        {modo === 'guiado' && (
          <>
            <FlujoGuiado repositorio={repositorio} paciente={paciente} setPaciente={setPaciente} onSalir={irInicio} />
            <p className="alternativa">
              ¿Preferís cargar todos los criterios juntos?{' '}
              <button type="button" className="boton-texto" onClick={() => setModo('formulario')}>
                Usar el formulario completo
              </button>
            </p>
          </>
        )}
        {modo === 'formulario' && <ModoFormulario repositorio={repositorio} paciente={paciente} setPaciente={setPaciente} onSalir={irInicio} />}
      </main>

      <footer className="pie">
        Servicio de Electrofisiología Pediátrica — Hospital Garrahan · Prototipo sin uso asistencial
      </footer>
    </div>
  );
}

interface PropsModo {
  repositorio: Repositorio | null;
  paciente: DatosPaciente | null;
  setPaciente: (d: DatosPaciente) => void;
  onSalir: () => void;
}

function FlujoGuiado({ repositorio, paciente, setPaciente, onSalir }: PropsModo) {
  const sesion = useRef(nuevaSesion());
  if (!paciente) return <FormularioPaciente onConfirmar={setPaciente} />;
  return (
    <Asistente
      encabezado={<EncabezadoPaciente datos={paciente} onCambiar={setPaciente} />}
      alTerminar={({ resultado, confirmadas }) => (
        <GuardarRegistro
          sesion={sesion}
          datos={{ modo: 'guiado', paciente, criterios: confirmadas, resultado }}
          paciente={paciente}
          repositorio={repositorio}
          onOtroPaciente={onSalir}
        />
      )}
      onSalir={onSalir}
    />
  );
}

function ModoFormulario({ repositorio, paciente, setPaciente, onSalir }: PropsModo) {
  const sesion = useRef(nuevaSesion());
  const [entrada, setEntrada] = useState<EntradaECG>(ENTRADA_VACIA);
  const [resultado, setResultado] = useState<ResultadoArruda | null>(null);
  const [desactualizado, setDesactualizado] = useState(false);

  const cambiar = (campo: CampoECG, valor: string | null) => {
    setEntrada((prev) => ({ ...prev, [campo]: valor }));
    if (resultado) setDesactualizado(true);
  };
  const calcular = () => {
    setResultado(aplicarArruda(entrada));
    setDesactualizado(false);
  };
  const reiniciar = () => {
    setEntrada(ENTRADA_VACIA);
    setResultado(null);
    setDesactualizado(false);
  };

  if (!paciente) return <FormularioPaciente onConfirmar={setPaciente} />;

  return (
    <>
      <EncabezadoPaciente datos={paciente} onCambiar={setPaciente} />
      <div className="contenido">
        <FormularioECG
          entrada={entrada}
          faltantes={resultado && !desactualizado ? resultado.datosFaltantes : []}
          onCambio={cambiar}
          onCalcular={calcular}
          onReiniciar={reiniciar}
        />
        <div className="columna-resultado">
          <PanelResultado resultado={resultado} desactualizado={desactualizado} onReiniciar={reiniciar} />
          {resultado && !desactualizado && (
            <GuardarRegistro
              sesion={sesion}
              datos={{ modo: 'formulario', paciente, criterios: entrada, resultado }}
              paciente={paciente}
              repositorio={repositorio}
              onOtroPaciente={onSalir}
            />
          )}
        </div>
      </div>
      <div className="acciones">
        <button type="button" className="boton-texto" onClick={onSalir}>
          Volver al inicio
        </button>
      </div>
    </>
  );
}
