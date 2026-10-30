import { NOMBRES_CAMPOS, NOMBRES_VALORES } from '../algoritmo/catalogo';
import type { EstadoResultado, ResultadoArruda } from '../algoritmo/tipos';
import { useState } from 'react';
import { DiagramaAnillos } from './DiagramaAnillos';
import { Visor3D } from './Visor3D';

const ETIQUETA_ESTADO: Record<EstadoResultado, string> = {
  region_predicha: 'Región predicha',
  datos_insuficientes: 'Datos insuficientes',
  indeterminado: 'Resultado indeterminado',
  no_clasificable: 'No clasificable',
};

interface Props {
  resultado: ResultadoArruda | null;
  desactualizado: boolean;
  onReiniciar: () => void;
  /** Título del panel (por defecto, "Resultado"). */
  titulo?: string;
  /** Sin botones de 3D ni de reinicio (resultado secundario, de comparación). */
  sinAcciones?: boolean;
}

export function PanelResultado({ resultado, desactualizado, onReiniciar, titulo = 'Resultado', sinAcciones = false }: Props) {
  const [ver3D, setVer3D] = useState(false);
  if (!resultado) {
    return (
      <section className="panel-resultado vacio" aria-labelledby="titulo-resultado">
        <h2 id="titulo-resultado">Resultado</h2>
        <p>
          Completá los criterios y pulsá <strong>Calcular localización</strong>. Solo se pedirán los
          datos necesarios para la rama que siga el algoritmo.
        </p>
      </section>
    );
  }

  const r = resultado;
  return (
    <section
      className={`panel-resultado estado-${r.estado}${desactualizado ? ' desactualizado' : ''}`}
      aria-labelledby={sinAcciones ? undefined : 'titulo-resultado'}
      aria-label={sinAcciones ? titulo : undefined}
      aria-live="polite"
      data-testid={sinAcciones ? 'panel-resultado-comparacion' : 'panel-resultado'}
    >
      <h2 id={sinAcciones ? undefined : 'titulo-resultado'}>{titulo}</h2>

      {desactualizado && (
        <p className="alerta" role="status">
          Modificaste los datos después del cálculo. Este resultado ya no corresponde a lo ingresado:
          pulsá <strong>Calcular localización</strong> otra vez.
        </p>
      )}

      <p className="estado-etiqueta" data-testid="estado">
        {ETIQUETA_ESTADO[r.estado]}
      </p>

      {r.regiones.length > 0 && (
        <div className="regiones">
          {r.regiones.length > 1 && (
            <p className="nota">El algoritmo no discrimina entre estas localizaciones:</p>
          )}
          <ul>
            {r.regiones.map((reg) => (
              <li key={reg.codigo} className="region" data-testid="region">
                <span className="region-abrev">{reg.abreviatura}</span>
                <span className="region-desc">
                  {reg.descripcion}
                  <span className="region-grupo"> · {reg.grupo}</span>
                  {reg.abreviaturaInterna && (
                    <span className="region-nota"> (abreviatura interna de esta herramienta)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mensaje">{r.mensaje}</p>

      {r.regiones.length > 0 && <DiagramaAnillos predichas={r.regiones.map((x) => x.codigo)} />}
      {r.regiones.length > 0 && !sinAcciones && (
        <button type="button" className="boton-3d" onClick={() => setVer3D(true)} disabled={desactualizado}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
            <path d="M4 7.5 12 12l8-4.5M12 12v9" />
          </svg>
          Ubicación 3D
        </button>
      )}
      {ver3D && <Visor3D regiones={r.regiones} onCerrar={() => setVer3D(false)} />}

      {r.datosFaltantes.length > 0 && (
        <div className="faltantes">
          <h3>Datos a completar</h3>
          <ul>
            {r.datosFaltantes.map((c) => (
              <li key={c}>{NOMBRES_CAMPOS[c]}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="advertencia-prediccion">
        Predicción algorítmica a partir del ECG de superficie.{' '}
        <strong>No es una localización confirmada</strong>: la localización real solo se demuestra
        durante el estudio electrofisiológico.
      </p>

      <h3>Recorrido del algoritmo</h3>
      <ol className="ruta" data-testid="ruta">
        {r.ruta.map((p) => (
          <li key={p.paso} className={`paso paso-${p.desenlace}`}>
            <p className="paso-titulo">{p.titulo}</p>
            <p className="paso-pregunta">{p.pregunta}</p>
            <p className="paso-decision">{p.decision}</p>
          </li>
        ))}
      </ol>

      <h3>Criterios que determinaron la rama final</h3>
      <table className="criterios">
        <thead>
          <tr>
            <th scope="col">Criterio</th>
            <th scope="col">Valor ingresado</th>
          </tr>
        </thead>
        <tbody>
          {r.criteriosDeterminantes.map((c) => (
            <tr key={c.campo}>
              <td>{NOMBRES_CAMPOS[c.campo]}</td>
              <td>{NOMBRES_VALORES[c.valor] ?? c.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="referencia">
        <p>
          <strong>Referencia:</strong> {r.referencia}
        </p>
        <p>
          <strong>Versión de la implementación:</strong> {r.versionAlgoritmo}
        </p>
      </div>

      {!sinAcciones && (
        <button type="button" className="boton-secundario" onClick={onReiniciar}>
          Reiniciar cálculo
        </button>
      )}
    </section>
  );
}
