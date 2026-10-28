import { useState } from 'react';
import { aplicarArruda, ENTRADA_VACIA } from './algoritmo/arruda';
import type { CampoECG, EntradaECG, ResultadoArruda } from './algoritmo/tipos';
import type { LectorIA } from './ia/lectorIA';
import type { ImagenPreparada } from './imagen/preparar';
import { Asistente } from './componentes/Asistente';
import { ExplicacionAlgoritmo } from './componentes/ExplicacionAlgoritmo';
import { FormularioECG } from './componentes/FormularioECG';
import { ModoImagen } from './componentes/ModoImagen';
import { PanelResultado } from './componentes/PanelResultado';
import { PantallaInicio } from './componentes/PantallaInicio';

type Modo = 'inicio' | 'imagen' | 'guiado' | 'formulario';

interface Props {
  /** Inyectables para pruebas del modo imagen. */
  obtenerLector?: () => Promise<LectorIA | null>;
  preparar?: (f: File) => Promise<ImagenPreparada>;
}

export function App({ obtenerLector, preparar }: Props = {}) {
  const [modo, setModo] = useState<Modo>('inicio');
  const irInicio = () => setModo('inicio');

  return (
    <div className="app">
      <header className="encabezado">
        <h1>WPW Navigator 3D by Longa</h1>
        <p className="subtitulo">Localización de vías accesorias — Algoritmo de Arruda</p>
      </header>

      <p className="aviso-investigacion" role="note">
        <strong>Prototipo de investigación.</strong> No reemplaza la evaluación clínica ni el estudio
        electrofisiológico. Las reglas implementadas deben revisarse contra la publicación original
        antes de cualquier uso asistencial. No ingreses datos identificables de pacientes; no se
        guarda ningún dato.
      </p>

      <main>
        {modo === 'inicio' && <PantallaInicio onElegir={setModo} />}
        {modo === 'imagen' && <ModoImagen onSalir={irInicio} obtenerLector={obtenerLector} preparar={preparar} />}
        {modo === 'guiado' && (
          <>
            <Asistente onSalir={irInicio} />
            <p className="alternativa">
              ¿Preferís cargar todos los criterios juntos?{' '}
              <button type="button" className="boton-texto" onClick={() => setModo('formulario')}>
                Usar el formulario completo
              </button>
            </p>
          </>
        )}
        {modo === 'formulario' && <ModoFormulario onSalir={irInicio} />}
      </main>

      <ExplicacionAlgoritmo />

      <footer className="pie">
        Servicio de Electrofisiología Pediátrica — Hospital Garrahan · Prototipo sin uso asistencial
      </footer>
    </div>
  );
}

function ModoFormulario({ onSalir }: { onSalir: () => void }) {
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

  return (
    <>
      <div className="contenido">
        <FormularioECG
          entrada={entrada}
          faltantes={resultado && !desactualizado ? resultado.datosFaltantes : []}
          onCambio={cambiar}
          onCalcular={calcular}
          onReiniciar={reiniciar}
        />
        <PanelResultado resultado={resultado} desactualizado={desactualizado} onReiniciar={reiniciar} />
      </div>
      <div className="acciones">
        <button type="button" className="boton-texto" onClick={onSalir}>
          Volver al inicio
        </button>
      </div>
    </>
  );
}
