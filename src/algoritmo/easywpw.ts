/**
 * Implementación determinista del algoritmo EASY-WPW (El Hamriti et al., Europace 2023).
 * Transcripción del diagrama en docs/algoritmos/EASY-WPW.md.
 *
 * Mismos principios que Arruda: un dato vacío nunca se interpreta como un valor
 * clínico, solo se piden los datos de la rama recorrida y, si no se puede decidir,
 * no se inventa una localización.
 */
import { NOMBRES_VALORES, REFERENCIA_EASY_WPW, REGIONES, VERSION_EASY_WPW } from './catalogo';
import type { CampoECG, CodigoRegion, CriterioUsado, EntradaECG, PasoTraza, ResultadoAlgoritmo } from './tipos';
import type { FinRuta } from './arruda';

export const PASOS_EASY = ['Lado (V1)', 'Transición del QRS', 'Delta más positiva'];

const txt = (v: string | null) => NOMBRES_VALORES[v ?? 'sin_dato'] ?? String(v);
const crit = (e: EntradaECG, campo: CampoECG): CriterioUsado => ({ campo, valor: e[campo] ?? 'sin_dato' });

const faltante = (campo: CampoECG, nombre: string): FinRuta => ({
  estado: 'datos_insuficientes',
  regiones: [],
  mensaje: `Completá ${nombre} para continuar por esta rama.`,
  datosFaltantes: [campo],
});
const indeterminado = (mensaje: string): FinRuta => ({ estado: 'indeterminado', regiones: [], mensaje, datosFaltantes: [] });
const prediccion = (regiones: CodigoRegion[], mensaje: string): FinRuta => ({
  estado: 'region_predicha',
  regiones,
  mensaje,
  datosFaltantes: [],
});

/** Vías izquierdas (anillo mitral): delta más positiva → sitio. */
const IZQUIERDA: Record<'ii' | 'iii' | 'avr' | 'avl', { region: CodigoRegion; texto: string }> = {
  avl: { region: 'PSMA', texto: 'posteroseptal izquierda' },
  ii: { region: 'LP_LPL', texto: 'posterolateral izquierda' },
  avr: { region: 'LP_LPL', texto: 'posterolateral izquierda' },
  iii: { region: 'LL_LAL', texto: 'anterolateral izquierda' },
};

/** Vías derechas (anillo tricuspídeo), según la transición. */
const DERECHA_SEPTAL: Record<'ii' | 'iii' | 'avr' | 'avl', { region: CodigoRegion; texto: string }> = {
  ii: { region: 'AS_RAPS', texto: 'anteroseptal derecha' },
  iii: { region: 'AS_RAPS', texto: 'anteroseptal derecha' },
  avl: { region: 'PSTA', texto: 'posteroseptal derecha' },
  avr: { region: 'PSTA', texto: 'posteroseptal derecha' },
};
const DERECHA_LATERAL: Record<'ii' | 'iii' | 'avr' | 'avl', { region: CodigoRegion; texto: string }> = {
  ii: { region: 'RA_RAL', texto: 'anterolateral derecha' },
  iii: { region: 'AS_RAPS', texto: 'anteroseptal derecha' },
  avr: { region: 'PSTA', texto: 'posteroseptal derecha' },
  avl: { region: 'RP_RPL', texto: 'posterolateral derecha' },
};

/** Último paso: la derivación con la delta más positiva decide el sitio. */
function pasoDelta(
  e: EntradaECG,
  paso: 2 | 3,
  tabla: Record<'ii' | 'iii' | 'avr' | 'avl', { region: CodigoRegion; texto: string }>,
  contexto: string,
): { traza: PasoTraza; fin: FinRuta } {
  const base = { paso, titulo: `Paso ${paso} — Delta más positiva`, pregunta: '¿En qué derivación (II, III, aVR o aVL) la onda delta es más positiva?', criterios: [crit(e, 'deltaMasPositiva')] };
  const v = e.deltaMasPositiva;
  if (v === null) return { traza: { ...base, decision: 'Sin dato → se detiene.', desenlace: 'detiene' }, fin: faltante('deltaMasPositiva', 'la derivación con la onda delta más positiva') };
  if (v === 'empate') return { traza: { ...base, decision: 'Empate entre derivaciones → indeterminado.', desenlace: 'detiene' }, fin: indeterminado('Dos derivaciones tienen una onda delta igual de positiva; el algoritmo no define ese caso.') };
  if (v === 'no_evaluable') return { traza: { ...base, decision: 'No evaluable → se detiene.', desenlace: 'detiene' }, fin: indeterminado('La derivación con la onda delta más positiva fue marcada como no evaluable.') };
  const r = tabla[v];
  return {
    traza: { ...base, decision: `${contexto}; delta más positiva en ${txt(v)} → ${REGIONES[r.region].abreviatura} (${r.texto}).`, desenlace: 'clasifica' },
    fin: prediccion([r.region], `${contexto}, delta más positiva en ${txt(v)}.`),
  };
}

/** Aplica EASY-WPW y devuelve el resultado con su trazabilidad. */
export function aplicarEasyWPW(e: EntradaECG): ResultadoAlgoritmo {
  const ruta: PasoTraza[] = [];
  let fin: FinRuta;

  // Paso 1: polaridad del QRS en V1
  const p1 = { paso: 1 as const, titulo: 'Paso 1 — Lado (V1)', pregunta: '¿Cómo es la polaridad del QRS en V1?', criterios: [crit(e, 'qrsV1')] };
  if (e.qrsV1 === null) {
    ruta.push({ ...p1, decision: 'Sin dato → se detiene.', desenlace: 'detiene' });
    fin = faltante('qrsV1', 'la polaridad del QRS en V1');
  } else if (e.qrsV1 === 'no_evaluable') {
    ruta.push({ ...p1, decision: 'No evaluable → se detiene.', desenlace: 'detiene' });
    fin = indeterminado('La polaridad del QRS en V1 fue marcada como no evaluable.');
  } else if (e.qrsV1 === 'positiva') {
    ruta.push({ ...p1, decision: 'Positiva → vía izquierda (anillo mitral).', desenlace: 'continua' });
    const s = pasoDelta(e, 2, IZQUIERDA, 'Vía izquierda');
    ruta.push(s.traza);
    fin = s.fin;
  } else {
    ruta.push({ ...p1, decision: `${txt(e.qrsV1)} → vía derecha (anillo tricuspídeo).`, desenlace: 'continua' });
    // Paso 2: transición del QRS
    const p2 = { paso: 2 as const, titulo: 'Paso 2 — Transición del QRS', pregunta: '¿La transición del QRS en precordiales ocurre hasta V3?', criterios: [crit(e, 'transicionQRS')] };
    if (e.transicionQRS === null) {
      ruta.push({ ...p2, decision: 'Sin dato → se detiene.', desenlace: 'detiene' });
      fin = faltante('transicionQRS', 'la transición del QRS en precordiales');
    } else if (e.transicionQRS === 'no_evaluable') {
      ruta.push({ ...p2, decision: 'No evaluable → se detiene.', desenlace: 'detiene' });
      fin = indeterminado('La transición del QRS fue marcada como no evaluable.');
    } else {
      const septal = e.transicionQRS === 'hasta_v3';
      ruta.push({ ...p2, decision: septal ? 'Sí (hasta V3) → se evalúa la delta más positiva.' : 'No (V4 o después) → se evalúa la delta más positiva.', desenlace: 'continua' });
      const s = pasoDelta(e, 3, septal ? DERECHA_SEPTAL : DERECHA_LATERAL, `Vía derecha, transición ${septal ? 'hasta V3' : 'en V4 o después'}`);
      ruta.push(s.traza);
      fin = s.fin;
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
    versionAlgoritmo: VERSION_EASY_WPW,
    referencia: REFERENCIA_EASY_WPW,
    algoritmo: 'easy_wpw',
    nombresPasos: PASOS_EASY,
  };
}
