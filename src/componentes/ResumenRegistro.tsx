import { useEffect, useState } from 'react';
import { REGIONES } from '../algoritmo/catalogo';
import type { CodigoRegion } from '../algoritmo/tipos';
import { NOMBRES_GRUPO, NOMBRES_SEXO, type GrupoEtario, type Sexo } from '../registro/paciente';
import { resumir, type Repositorio, type Resumen } from '../registro/registro';

const ORDEN_GRUPOS: GrupoEtario[] = ['neonato', 'lactante', 'preescolar', 'escolar', 'adolescente', 'adulto'];

function nombreRegion(clave: string): string {
  return clave
    .split(' o ')
    .map((c) => REGIONES[c as CodigoRegion]?.abreviatura ?? c)
    .join(' o ');
}

/** Resumen en vivo del registro, en la pantalla de inicio. */
export function ResumenRegistro({ repositorio }: { repositorio: Repositorio | null }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    if (!repositorio) return;
    return repositorio.escuchar((regs) => setResumen(resumir(regs)));
  }, [repositorio]);

  if (!repositorio) return null;

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
              titulo="Región predicha"
              filas={Object.entries(resumen.porRegion)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => [nombreRegion(k), n])}
              total={resumen.total}
              nota={
                resumen.total - Object.values(resumen.porRegion).reduce((a, b) => a + b, 0) > 0
                  ? `${resumen.total - Object.values(resumen.porRegion).reduce((a, b) => a + b, 0)} sin región (indeterminados o incompletos)`
                  : undefined
              }
            />
          </div>
        </>
      )}
    </section>
  );
}

function Tabla({ titulo, filas, total, nota }: { titulo: string; filas: [string, number][]; total: number; nota?: string }) {
  return (
    <div className="resumen-tabla">
      <table className="criterios">
        <caption>{titulo}</caption>
        <tbody>
          {filas.map(([k, n]) => (
            <tr key={k}>
              <td>{k}</td>
              <td className="num">{n}</td>
              <td className="num">{Math.round((n / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {nota && <p className="nota">{nota}</p>}
    </div>
  );
}
