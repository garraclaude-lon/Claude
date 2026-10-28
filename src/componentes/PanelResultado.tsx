import { NOMBRES_CAMPOS, NOMBRES_VALORES } from '../algoritmo/catalogo';
import type { EstadoResultado, ResultadoArruda } from '../algoritmo/tipos';
import { DiagramaAnillos } from './DiagramaAnillos';

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
}

export function PanelResultado({ resultado, desactualizado, onReiniciar }: Props) {
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
      aria-labelledby="titulo-resultado"
      aria-live="polite"
      data-testid="panel-resultado"
    >
      <h2 id="titulo-resultado">Resultado</h2>

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

      <button type="button" className="boton-secundario" onClick={onReiniciar}>
        Reiniciar cálculo
      </button>
    </section>
  );
}
