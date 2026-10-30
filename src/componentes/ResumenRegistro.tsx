import { useEffect, useState } from 'react';
import { NOMBRES_CONCORDANCIA, type Concordancia } from '../registro/eef';
import { NOMBRES_GRUPO, NOMBRES_SEXO, type GrupoEtario, type Sexo } from '../registro/paciente';
import { NOMBRES_ALGORITMO } from '../algoritmo/catalogo';
import type { CodigoAlgoritmo } from '../algoritmo/tipos';
import { prediccionesDe, resumir, tasaConcordancia, type RegistroGuardado, type Repositorio, type Resumen } from '../registro/registro';
import { BuscarPorCodigo, EditorEEF, fechaCorta, nombreRegiones, pacienteCorto, textoPredicciones } from './CargarEEF';

const ORDEN_GRUPOS: GrupoEtario[] = ['neonato', 'lactante', 'preescolar', 'escolar', 'adolescente', 'adulto'];
const ORDEN_CONCORDANCIA: Concordancia[] = ['concordante', 'parcial', 'discordante', 'sin_prediccion', 'no_evaluable'];
const MAX_PENDIENTES = 10;

/** Resumen en vivo del registro y carga de resultados del EEF, en la pantalla de inicio. */
export function ResumenRegistro({ repositorio }: { repositorio: Repositorio | null }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [editando, setEditando] = useState<RegistroGuardado | null>(null);

  useEffect(() => {
    if (!repositorio) return;
    return repositorio.escuchar((regs) => setResumen(resumir(regs)));
  }, [repositorio]);

  if (!repositorio) return null;

  const sinRegion = resumen ? resumen.total - Object.values(resumen.porRegion).reduce((a, b) => a + b, 0) : 0;
  const tasa = resumen ? tasaConcordancia(resumen) : null;

  return (
    <section className="resumen-registro" aria-labelledby="titulo-resumen">
      <h2 id="titulo-resumen">Registro del servicio</h2>
      {!resumen ? (
        <p className="nota">Cargando registro…</p>
      ) : resumen.total === 0 ? (
        <p className="nota">
          Todavía no hay análisis guardados. Al terminar cada análisis, pulsá “Guardar en el registro”.
        </p>
      ) : (
        <>
          <p className="resumen-total" data-testid="resumen-total">
            <strong>{resumen.total}</strong> {resumen.total === 1 ? 'análisis guardado' : 'análisis guardados'}
            <span className="resumen-sub"> · {resumen.conEEF} con resultado de EEF</span>
          </p>
          <div className="resumen-tablas">
            <Tabla
              titulo="Sexo"
              filas={(['femenino', 'masculino', 'no_consignado'] as Sexo[])
                .filter((s) => resumen.porSexo[s])
                .map((s) => [NOMBRES_SEXO[s], resumen.porSexo[s]])}
              total={resumen.total}
            />
            <Tabla
              titulo="Grupo etario"
              filas={ORDEN_GRUPOS.filter((g) => resumen.porGrupo[g]).map((g) => [NOMBRES_GRUPO[g], resumen.porGrupo[g]])}
              total={resumen.total}
            />
            <Tabla
              titulo="Región predicha (algoritmo principal)"
              filas={Object.entries(resumen.porRegion)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => [nombreRegiones(k.split(' o ')), n])}
              total={resumen.total}
              nota={sinRegion > 0 ? `${sinRegion} sin región (indeterminados o incompletos)` : undefined}
            />
            {resumen.conEEF > 0 && tasa && (
              <Tabla
                titulo="Algoritmo principal frente al EEF"
                filas={ORDEN_CONCORDANCIA.filter((c) => resumen.porConcordancia[c]).map((c) => [
                  NOMBRES_CONCORDANCIA[c],
                  resumen.porConcordancia[c] ?? 0,
                ])}
                total={resumen.conEEF}
                nota={
                  tasa.comparables > 0
                    ? `Coincidencia: ${tasa.aciertos} de ${tasa.comparables} casos comparables (${Math.round((tasa.aciertos / tasa.comparables) * 100)}%).${tasa.comparables < 30 ? ' Muestra chica: interpretar con cautela.' : ''}`
                    : undefined
                }
              />
            )}
          </div>
          {Object.keys(resumen.porAlgoritmo).length > 0 && <AciertosPorAlgoritmo resumen={resumen} />}
        </>
      )}

      <div className="eef-pendientes" aria-labelledby="titulo-pendientes">
        <h3 id="titulo-pendientes">Cargar resultado del estudio electrofisiológico</h3>
        {editando ? (
          <EditorEEF registro={editando} repositorio={repositorio} onCerrar={() => setEditando(null)} />
        ) : (
          <>
            <BuscarPorCodigo repositorio={repositorio} onEncontrado={setEditando} />
            {resumen && resumen.pendientesEEF.length > 0 ? (
              <div className="tabla-desplazable">
                <table className="criterios" data-testid="tabla-pendientes">
                  <caption>Pendientes de EEF ({resumen.pendientesEEF.length})</caption>
                  <thead>
                    <tr>
                      <th scope="col">Código</th>
                      <th scope="col">Analizado</th>
                      <th scope="col">Paciente</th>
                      <th scope="col">Predicción</th>
                      <th scope="col"><span className="solo-lector">Acción</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.pendientesEEF.slice(0, MAX_PENDIENTES).map((r) => (
                      <tr key={r.codigo}>
                        <td className="codigo-celda">{r.codigo}</td>
                        <td className="fecha">{fechaCorta(r.creadoEn)}</td>
                        <td>{pacienteCorto(r)}</td>
                        <td>{textoPredicciones(prediccionesDe(r))}</td>
                        <td>
                          <button type="button" className="boton-texto" onClick={() => setEditando(r)}>
                            Cargar EEF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {resumen.pendientesEEF.length > MAX_PENDIENTES && (
                  <p className="nota">
                    Se muestran los {MAX_PENDIENTES} más recientes. Para los demás, buscá por código.
                  </p>
                )}
              </div>
            ) : (
              resumen && resumen.total > 0 && <p className="nota">No hay análisis pendientes de EEF.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

/** Aciertos de cada algoritmo frente al EEF y comparación pareada (mismo ECG). */
function AciertosPorAlgoritmo({ resumen }: { resumen: Resumen }) {
  const algs = (['easy_wpw', 'arruda'] as CodigoAlgoritmo[]).filter((a) => resumen.porAlgoritmo[a]);
  const p = resumen.pareado;
  return (
    <div className="aciertos-algoritmos" data-testid="aciertos-algoritmos">
      <table className="criterios">
        <caption>Aciertos frente al EEF, por algoritmo</caption>
        <thead>
          <tr>
            <th scope="col">Algoritmo</th>
            <th scope="col">Casos</th>
            <th scope="col">Coincide</th>
            <th scope="col">Una de dos</th>
            <th scope="col">No coincide</th>
            <th scope="col">Sin predicción</th>
            <th scope="col">Error medio</th>
          </tr>
        </thead>
        <tbody>
          {algs.map((a) => {
            const x = resumen.porAlgoritmo[a]!;
            return (
              <tr key={a}>
                <td>{NOMBRES_ALGORITMO[a]}</td>
                <td>{x.casos}</td>
                <td>
                  {x.coincide} ({pct(x.coincide, x.casos)})
                </td>
                <td>{x.parcial}</td>
                <td>{x.noCoincide}</td>
                <td>{x.sinPrediccion}</td>
                <td title="Distancia promedio en horas del reloj entre la región predicha y el sitio confirmado (mismo anillo)">
                  {x.conHora > 0 ? `${(x.sumaHoras / x.conHora).toFixed(1)} h (n=${x.conHora})` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {p.casos > 0 && (
        <p className="nota" data-testid="comparacion-pareada">
          Mismo ECG con los dos algoritmos: {p.casos} {p.casos === 1 ? 'caso' : 'casos'}. Aciertan ambos: {p.ambos} · solo
          EASY-WPW: {p.soloEasy} · solo Arruda: {p.soloArruda} · ninguno: {p.ninguno}.
          {p.casos < 30 && ' Muestra chica: interpretar con cautela.'}
        </p>
      )}
    </div>
  );
}

function Tabla({ titulo, filas, total, nota }: { titulo: string; filas: [string, number][]; total: number; nota?: string }) {
  return (
    <div className="resumen-tabla">
      <table className="criterios tabla-barras">
        <caption>{titulo}</caption>
        <tbody>
          {filas.map(([k, n]) => {
            const pct = Math.round((n / total) * 100);
            return (
              <tr key={k} title={`${k}: ${n} (${pct}%)`}>
                <td className="tb-nombre">
                  <span>{k}</span>
                  <span className="tb-barra" aria-hidden="true">
                    <span style={{ width: `${Math.max(pct, 2)}%` }} />
                  </span>
                </td>
                <td className="num">{n}</td>
                <td className="num tb-pct">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {nota && <p className="nota">{nota}</p>}
    </div>
  );
}
