import { REGIONES } from '../algoritmo/catalogo';
import type { CodigoRegion } from '../algoritmo/tipos';
import { POR_CODIGO_EEF, type CodigoEEF } from '../registro/eef';

/**
 * Esquema orientativo de los anillos auriculoventriculares en proyección
 * oblicua anterior izquierda (OAI): tricúspide a la izquierda, mitral a la
 * derecha, septum en el medio, anterior arriba y posterior abajo.
 * No es anatómicamente exacto: sirve para ubicar de un vistazo la región.
 * Ángulos en grados, 0 = arriba, sentido horario.
 */

export type Anillo = 't' | 'm' | 'sc';

export interface Segmento {
  anillo: Anillo;
  desde: number;
  hasta: number;
  /** Etiqueta dentro del anillo (septales) o por fuera (paredes libres). */
  adentro?: boolean;
}

const T = { cx: 122, cy: 128, r: 74 };
const M = { cx: 298, cy: 128, r: 74 };
const RADIO_SC = M.r + 17;
const GROSOR = 11;
const SEPARACION = 2.5; // grados entre segmentos vecinos

export const SEGMENTOS: Partial<Record<CodigoRegion, Segmento[]>> = {
  RA_RAL: [{ anillo: 't', desde: 300, hasta: 352 }],
  RL: [{ anillo: 't', desde: 250, hasta: 300 }],
  RP_RPL: [{ anillo: 't', desde: 198, hasta: 250 }],
  PSTA: [{ anillo: 't', desde: 148, hasta: 198, adentro: true }],
  PSTA_CSOS: [{ anillo: 't', desde: 148, hasta: 198, adentro: true }],
  MSTA: [{ anillo: 't', desde: 100, hasta: 148, adentro: true }],
  AS_RAPS: [{ anillo: 't', desde: 28, hasta: 100, adentro: true }],
  LL_LAL: [{ anillo: 'm', desde: 18, hasta: 105 }],
  LP_LPL: [{ anillo: 'm', desde: 105, hasta: 165 }],
  PSMA: [{ anillo: 'm', desde: 165, hasta: 215, adentro: true }],
  PS_SUBEPI: [{ anillo: 'sc', desde: 172, hasta: 222 }],
};

/** Segmentos de base, siempre dibujados en gris (incluye zonas sin región). */
const BASE: Segmento[] = [
  { anillo: 't', desde: 28, hasta: 100 },
  { anillo: 't', desde: 100, hasta: 148 },
  { anillo: 't', desde: 148, hasta: 198 },
  { anillo: 't', desde: 198, hasta: 250 },
  { anillo: 't', desde: 250, hasta: 300 },
  { anillo: 't', desde: 300, hasta: 352 },
  { anillo: 't', desde: 352, hasta: 388 },
  { anillo: 'm', desde: 18, hasta: 105 },
  { anillo: 'm', desde: 105, hasta: 165 },
  { anillo: 'm', desde: 165, hasta: 215 },
  { anillo: 'm', desde: 215, hasta: 378 },
];

/** Posición del sitio confirmado por EEF. */
const SITIOS_EEF: Partial<Record<CodigoEEF, { anillo: Anillo; angulo: number }>> = {
  LAL: { anillo: 'm', angulo: 40 },
  LL: { anillo: 'm', angulo: 82 },
  LPL: { anillo: 'm', angulo: 122 },
  LP: { anillo: 'm', angulo: 150 },
  PSMA: { anillo: 'm', angulo: 192 },
  AS_PH: { anillo: 't', angulo: 62 },
  MS: { anillo: 't', angulo: 124 },
  PSTA: { anillo: 't', angulo: 168 },
  CSOS: { anillo: 't', angulo: 186 },
  PS_SUBEPI: { anillo: 'sc', angulo: 196 },
  RA: { anillo: 't', angulo: 338 },
  RAL: { anillo: 't', angulo: 314 },
  RL: { anillo: 't', angulo: 275 },
  RPL: { anillo: 't', angulo: 240 },
  RP: { anillo: 't', angulo: 212 },
};

/** Posición del sitio confirmado: por hora del reloj (XII arriba, III hacia el septum en el
 * tricuspídeo y hacia la pared lateral en el mitral) o, en registros viejos, por región. */
function posicionEEF(codigo: CodigoEEF): { anillo: Anillo; angulo: number } | undefined {
  const l = POR_CODIGO_EEF[codigo];
  if (l?.anillo && l.hora) return { anillo: l.anillo === 'TV' ? 't' : 'm', angulo: (l.hora * 30) % 360 };
  return SITIOS_EEF[codigo];
}

function centro(a: Anillo) {
  if (a === 't') return T;
  return { ...M, r: a === 'sc' ? RADIO_SC : M.r };
}

function punto(a: Anillo, angulo: number, dr = 0) {
  const c = centro(a);
  const rad = (angulo * Math.PI) / 180;
  return { x: c.cx + (c.r + dr) * Math.sin(rad), y: c.cy - (c.r + dr) * Math.cos(rad) };
}

function arco(s: Segmento): string {
  const c = centro(s.anillo);
  const a0 = s.desde + SEPARACION / 2;
  const a1 = s.hasta - SEPARACION / 2;
  const p0 = punto(s.anillo, a0);
  const p1 = punto(s.anillo, a1);
  const grande = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${c.r} ${c.r} 0 ${grande} 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
}

interface Props {
  predichas: readonly string[];
  confirmado?: CodigoEEF | null;
  titulo?: string;
  /** Sector horario predicho: se dibuja por horas exactas en lugar de la región. */
  sector?: { anillo: 'TV' | 'MV'; horas: readonly number[] } | null;
}

/** Arco de un sector horario (cada hora ocupa ±15° alrededor de hora × 30°). */
function segmentoSector(s: { anillo: 'TV' | 'MV'; horas: readonly number[] }): Segmento {
  const angulos = s.horas.map((h) => (h % 12) * 30);
  // Sectores que cruzan las XII (p. ej., XI–XII): se toma el ángulo continuo.
  const continuos = angulos.map((a) => (Math.max(...angulos) - a > 180 ? a + 360 : a));
  return { anillo: s.anillo === 'TV' ? 't' : 'm', desde: Math.min(...continuos) - 15, hasta: Math.max(...continuos) + 15 };
}

export function DiagramaAnillos({ predichas, confirmado, titulo = 'Ubicación en los anillos AV', sector = null }: Props) {
  const activos = sector ? [] : predichas.filter((c): c is CodigoRegion => c in SEGMENTOS);
  const sitio = confirmado ? posicionEEF(confirmado) : undefined;
  const descripcion = [
    sector
      ? `Sector predicho: anillo ${sector.anillo === 'TV' ? 'tricuspídeo' : 'mitral'}, ${sector.horas.join(' a ')} horas.`
      : activos.length > 0
        ? `Región predicha: ${activos.map((c) => REGIONES[c].abreviatura).join(' o ')}.`
        : 'Sin región predicha.',
    confirmado ? `Sitio confirmado por EEF: ${POR_CODIGO_EEF[confirmado].nombre}.` : '',
  ].join(' ');
  // Ostium del seno coronario: entre los dos anillos, abajo.
  const ostium = { x: (T.cx + M.cx) / 2, y: T.cy + T.r * 0.86 };

  return (
    <figure className="diagrama" data-testid="diagrama-anillos">
      <figcaption className="diagrama-titulo">{titulo}</figcaption>
      <svg viewBox="0 0 420 262" role="img" aria-label={`Esquema de los anillos auriculoventriculares. ${descripcion}`}>
        <text x="210" y="16" className="dg-orientacion" textAnchor="middle">ANTERIOR</text>
        <text x="210" y="256" className="dg-orientacion" textAnchor="middle">POSTERIOR</text>

        {/* Seno coronario (recorrido posterior del anillo mitral) */}
        <path d={arco({ anillo: 'sc', desde: 150, hasta: 232 })} className="dg-sc" />
        <circle cx={ostium.x} cy={ostium.y} r="4" className="dg-ostium" />

        {BASE.map((s, i) => (
          <path key={i} d={arco(s)} className="dg-base" strokeWidth={GROSOR} />
        ))}

        {activos.flatMap((c) =>
          (SEGMENTOS[c] ?? []).map((s, i) => (
            <path
              key={`${c}-${i}`}
              d={arco(s)}
              className={s.anillo === 'sc' ? 'dg-activo dg-activo-sc' : 'dg-activo'}
              strokeWidth={s.anillo === 'sc' ? 6 : GROSOR}
            />
          )),
        )}
        {sector && <path d={arco(segmentoSector(sector))} className="dg-activo" strokeWidth={GROSOR} data-testid="dg-sector" />}
        {activos.includes('PSTA_CSOS') && <circle cx={ostium.x} cy={ostium.y} r="6" className="dg-ostium-activo" />}

        {(Object.keys(SEGMENTOS) as CodigoRegion[])
          .filter((c) => c !== 'PSTA' || !activos.includes('PSTA_CSOS'))
          .filter((c) => c !== 'PSTA_CSOS' || activos.includes('PSTA_CSOS'))
          .map((c) => {
            const s = SEGMENTOS[c]![0];
            const medio = (s.desde + s.hasta) / 2;
            const p = punto(s.anillo, medio, s.adentro ? -24 : s.anillo === 'sc' ? 13 : 22);
            return (
              <text
                key={c}
                x={p.x}
                y={p.y}
                className={activos.includes(c) ? 'dg-etiqueta dg-etiqueta-activa' : 'dg-etiqueta'}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {REGIONES[c].abreviatura.replace(' subepicárdica', ' subepi')}
              </text>
            );
          })}

        <text x={T.cx} y={T.cy - 4} className="dg-anillo" textAnchor="middle">Tricúspide</text>
        <text x={T.cx} y={T.cy + 12} className="dg-lado" textAnchor="middle">derecha</text>
        <text x={M.cx} y={M.cy - 4} className="dg-anillo" textAnchor="middle">Mitral</text>
        <text x={M.cx} y={M.cy + 12} className="dg-lado" textAnchor="middle">izquierda</text>

        {sitio && (() => {
          const p = punto(sitio.anillo, sitio.angulo);
          return (
            <g className="dg-eef" data-testid="marca-eef">
              <circle cx={p.x} cy={p.y} r="9" className="dg-eef-aro" />
              <circle cx={p.x} cy={p.y} r="3.5" className="dg-eef-punto" />
            </g>
          );
        })()}
      </svg>
      <div className="diagrama-leyenda">
        <span><i className="ley-activo" aria-hidden="true" /> Región predicha</span>
        {confirmado && sitio && <span><i className="ley-eef" aria-hidden="true" /> Confirmado en EEF</span>}
        <span className="ley-nota">Esquema orientativo en OAI, no a escala</span>
      </div>
    </figure>
  );
}
