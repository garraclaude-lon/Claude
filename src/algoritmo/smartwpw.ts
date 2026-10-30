/**
 * Implementación determinista del algoritmo SMART-WPW (Khalaph et al., Heart Rhythm 2025).
 * Transcripción del diagrama (figura 2) en docs/algoritmos/SMART-WPW.md.
 *
 * Predice un SECTOR HORARIO del anillo (vista OAI, XII arriba), el mismo criterio con que el
 * servicio informa el sitio en el EEF. Para el esquema, el 3D y la comparación con los otros
 * algoritmos, cada sector se asocia además a una región de la app.
 */
import { NOMBRES_VALORES, REFERENCIA_SMART_WPW, REGIONES, VERSION_SMART_WPW } from './catalogo';
import type { FinRuta } from './arruda';
import type { CampoECG, CodigoRegion, CriterioUsado, EntradaECG, PasoTraza, ResultadoAlgoritmo, SectorHorario } from './tipos';

export const PASOS_SMART = ['Lado (delta en V1)', 'Septal o pared libre (V3)', 'Inferiores negativas'];

const ROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const txt = (v: string | null) => NOMBRES_VALORES[v ?? 'sin_dato'] ?? String(v);
const crit = (e: EntradaECG, campo: CampoECG): CriterioUsado => ({ campo, valor: e[campo] ?? 'sin_dato' });

interface DefSector extends SectorHorario {
  region: CodigoRegion;
}
const S = (anillo: 'TV' | 'MV', horas: number[], sigla: string, nombre: string, region: CodigoRegion): DefSector => ({
  anillo, horas, sigla, nombre, region,
});

/** Sectores por cantidad de inferiores negativas (0 a 3). */
const PARED_LIBRE: DefSector[] = [
  S('TV', [11, 12], 'A', 'anterior', 'RA_RAL'),
  S('TV', [9, 10], 'LA', 'lateral-anterior', 'RL'),
  S('TV', [8], 'LP', 'lateral-posterior', 'RP_RPL'),
  S('TV', [6, 7], 'P', 'posterior', 'RP_RPL'),
];
const SEPTAL: DefSector[] = [
  S('TV', [1, 2], 'AS', 'anteroseptal', 'AS_RAPS'),
  S('TV', [3], 'MS', 'medioseptal', 'MSTA'),
  S('TV', [4], 'MSP', 'medioseptal posterior', 'MSTA'),
  S('TV', [5], 'PS', 'posteroseptal', 'PSTA'),
];
const MITRAL: DefSector[] = [
  S('MV', [1, 2, 3], 'L', 'lateral', 'LL_LAL'),
  S('MV', [4], 'HPL', 'posterolateral alta', 'LP_LPL'),
  S('MV', [5], 'LPL', 'posterolateral baja', 'LP_LPL'),
  S('MV', [6, 7], 'P&PS', 'posterior y posteroseptal', 'PSMA'),
];

export const textoHorasSector = (s: SectorHorario) =>
  `${s.anillo === 'TV' ? 'Tricuspídeo' : 'Mitral'} ${s.horas.map((h) => ROM[h]).join('–')} (${s.nombre})`;

const faltante = (campo: CampoECG, nombre: string): FinRuta => ({
  estado: 'datos_insuficientes',
  regiones: [],
  mensaje: `Completá ${nombre} para continuar por esta rama.`,
  datosFaltantes: [campo],
});
const indeterminado = (mensaje: string): FinRuta => ({ estado: 'indeterminado', regiones: [], mensaje, datosFaltantes: [] });

const NOMBRES_INF: Record<'deltaII' | 'deltaIII' | 'deltaAVF', string> = { deltaII: 'II', deltaIII: 'III', deltaAVF: 'aVF' };

/** Paso de las inferiores: cuántas y cuáles tienen la delta negativa. */
function pasoInferiores(
  e: EntradaECG,
  paso: 2 | 3,
  tabla: DefSector[],
  contexto: string,
): { traza: PasoTraza; fin: FinRuta; sector?: DefSector } {
  const campos = ['deltaIII', 'deltaAVF', 'deltaII'] as const;
  const base = {
    paso,
    titulo: `Paso ${paso} — Inferiores negativas`,
    pregunta: '¿Cuántas inferiores (II, III, aVF) tienen la onda delta negativa, y cuáles?',
    criterios: campos.map((c) => crit(e, c)),
  };
  const sinDato = campos.find((c) => e[c] === null);
  if (sinDato) {
    return {
      traza: { ...base, decision: 'Sin dato → se detiene.', desenlace: 'detiene' },
      fin: faltante(sinDato, `la polaridad de la onda delta en ${NOMBRES_INF[sinDato]}`),
    };
  }
  const noEval = campos.find((c) => e[c] === 'no_evaluable');
  if (noEval) {
    return {
      traza: { ...base, decision: `Delta en ${NOMBRES_INF[noEval]} no evaluable → se detiene.`, desenlace: 'detiene' },
      fin: indeterminado(`La onda delta en ${NOMBRES_INF[noEval]} fue marcada como no evaluable.`),
    };
  }
  const neg = (c: (typeof campos)[number]) => e[c] === 'negativa';
  const patron = `${neg('deltaII') ? 'II ' : ''}${neg('deltaIII') ? 'III ' : ''}${neg('deltaAVF') ? 'aVF' : ''}`.trim();
  // Patrones del diagrama: ninguna; solo III; III y aVF; las tres.
  let n: number | null = null;
  if (!neg('deltaII') && !neg('deltaIII') && !neg('deltaAVF')) n = 0;
  else if (!neg('deltaII') && neg('deltaIII') && !neg('deltaAVF')) n = 1;
  else if (!neg('deltaII') && neg('deltaIII') && neg('deltaAVF')) n = 2;
  else if (neg('deltaII') && neg('deltaIII') && neg('deltaAVF')) n = 3;
  if (n === null) {
    return {
      traza: { ...base, decision: `Negativas: ${patron} → combinación no prevista en el diagrama.`, desenlace: 'detiene' },
      fin: indeterminado(`Delta negativa en ${patron}: el algoritmo solo contempla ninguna, III, III y aVF, o las tres.`),
    };
  }
  const s = tabla[n];
  const cuales = n === 0 ? 'ninguna' : patron;
  return {
    traza: {
      ...base,
      decision: `${contexto}; inferiores negativas: ${n} (${cuales}) → ${s.sigla} ${textoHorasSector(s)}.`,
      desenlace: 'clasifica',
    },
    fin: { estado: 'region_predicha', regiones: [s.region], mensaje: `${contexto}, ${n} inferiores negativas (${cuales}): sector ${textoHorasSector(s)}.`, datosFaltantes: [] },
    sector: s,
  };
}

/** Aplica SMART-WPW y devuelve el resultado con su trazabilidad y el sector horario. */
export function aplicarSmartWPW(e: EntradaECG): ResultadoAlgoritmo {
  const ruta: PasoTraza[] = [];
  let fin: FinRuta;
  let sector: DefSector | undefined;

  const p1 = { paso: 1 as const, titulo: 'Paso 1 — Lado (delta en V1)', pregunta: '¿Cómo es la onda delta en V1?', criterios: [crit(e, 'deltaV1')] };
  if (e.deltaV1 === null) {
    ruta.push({ ...p1, decision: 'Sin dato → se detiene.', desenlace: 'detiene' });
    fin = faltante('deltaV1', 'la polaridad de la onda delta en V1');
  } else if (e.deltaV1 === 'no_evaluable') {
    ruta.push({ ...p1, decision: 'No evaluable → se detiene.', desenlace: 'detiene' });
    fin = indeterminado('La onda delta en V1 fue marcada como no evaluable.');
  } else if (e.deltaV1 === 'positiva' || e.deltaV1 === 'isoelectrica') {
    // El artículo: en vías izquierdas posteriores o laterales V1 puede verse isoeléctrica.
    ruta.push({ ...p1, decision: `${txt(e.deltaV1)} → anillo mitral (vía izquierda).`, desenlace: 'continua' });
    const s = pasoInferiores(e, 2, MITRAL, 'Mitral');
    ruta.push(s.traza);
    fin = s.fin;
    sector = s.sector;
  } else {
    ruta.push({ ...p1, decision: 'Negativa → anillo tricuspídeo (vía derecha).', desenlace: 'continua' });
    const p2 = { paso: 2 as const, titulo: 'Paso 2 — Septal o pared libre (V3)', pregunta: '¿Cómo es la polaridad del QRS en V3?', criterios: [crit(e, 'qrsV3')] };
    if (e.qrsV3 === null) {
      ruta.push({ ...p2, decision: 'Sin dato → se detiene.', desenlace: 'detiene' });
      fin = faltante('qrsV3', 'la polaridad del QRS en V3');
    } else if (e.qrsV3 === 'no_evaluable' || e.qrsV3 === 'isoelectrica') {
      ruta.push({ ...p2, decision: `${txt(e.qrsV3)} → no se puede decidir septal o pared libre.`, desenlace: 'detiene' });
      fin = indeterminado(`La polaridad del QRS en V3 es ${txt(e.qrsV3)}; el algoritmo necesita positiva (septal) o negativa (pared libre).`);
    } else {
      const septal = e.qrsV3 === 'positiva';
      ruta.push({ ...p2, decision: septal ? 'Positiva → septal.' : 'Negativa → pared libre.', desenlace: 'continua' });
      const s = pasoInferiores(e, 3, septal ? SEPTAL : PARED_LIBRE, septal ? 'Tricuspídeo septal' : 'Tricuspídeo, pared libre');
      ruta.push(s.traza);
      fin = s.fin;
      sector = s.sector;
    }
  }

  const vistos = new Set<CampoECG>();
  const criteriosDeterminantes: CriterioUsado[] = [];
  for (const p of ruta) for (const c of p.criterios) if (!vistos.has(c.campo)) { vistos.add(c.campo); criteriosDeterminantes.push(c); }

  return {
    estado: fin.estado,
    regiones: fin.regiones.map((c) => REGIONES[c]),
    mensaje: fin.mensaje,
    ruta,
    criteriosDeterminantes,
    datosFaltantes: fin.datosFaltantes,
    versionAlgoritmo: VERSION_SMART_WPW,
    referencia: REFERENCIA_SMART_WPW,
    algoritmo: 'smart_wpw',
    nombresPasos: PASOS_SMART,
    sector: sector ? { anillo: sector.anillo, horas: sector.horas, sigla: sector.sigla, nombre: sector.nombre } : undefined,
  };
}
