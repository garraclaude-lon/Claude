/**
 * Localización de la vía accesoria confirmada en el estudio electrofisiológico
 * (EEF) y su comparación con la región que predijo el algoritmo.
 *
 * La correspondencia entre cada sitio confirmado y las regiones de Arruda
 * (`compatibles`) es una propuesta de esta herramienta y DEBE revisarla el
 * equipo de electrofisiología (ver docs/LIMITACIONES.md).
 */
import type { CodigoAlgoritmo, CodigoRegion } from '../algoritmo/tipos';

export type Hora = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type AnilloEEF = 'TV' | 'MV';

/** Sitio por anillo y hora, con el criterio horario del servicio (docs/RELOJ-ANILLOS.md). */
export type CodigoHora = `${AnilloEEF}_${Hora}`;

/** Códigos de la lista anterior (por región); se conservan para los registros ya guardados. */
export type CodigoEEFLegado =
  | 'LAL' | 'LL' | 'LPL' | 'LP' | 'PSMA'
  | 'AS_PH' | 'MS' | 'PSTA' | 'CSOS'
  | 'RA' | 'RAL' | 'RL' | 'RPL' | 'RP';

export type CodigoEEF = CodigoHora | CodigoEEFLegado | 'PS_SUBEPI' | 'MULTIPLES' | 'NO_LOCALIZADA';

export type FuenteEEF = 'ablacion_exitosa' | 'mapeo_sin_ablacion';

export interface LocalizacionEEF {
  codigo: CodigoEEF;
  nombre: string;
  grupo: string;
  /** Regiones de los algoritmos que se consideran coincidentes con este sitio. */
  compatibles: CodigoRegion[];
  /** false = no se puede comparar (vías múltiples, sin localizar). */
  evaluable: boolean;
  anillo?: AnilloEEF;
  hora?: Hora;
  /** De la lista anterior (por región): solo para mostrar registros viejos. */
  legado?: boolean;
}

const L = (codigo: CodigoEEF, nombre: string, grupo: string, compatibles: CodigoRegion[], legado = true): LocalizacionEEF => ({
  codigo, nombre, grupo, compatibles, evaluable: codigo !== 'MULTIPLES' && codigo !== 'NO_LOCALIZADA', legado,
});

export const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const HORAS: Hora[] = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const NOMBRES_ANILLO: Record<AnilloEEF, string> = { TV: 'Tricuspídeo', MV: 'Mitral' };

/**
 * Criterio horario del servicio (vista OAI, XII arriba). Para cada hora: sector y regiones de
 * los algoritmos que coinciden. Las horas con dos regiones posibles (TV IV, MV VI–VII) quedan
 * así hasta que el equipo confirme el criterio (docs/RELOJ-ANILLOS.md).
 */
const SECTORES: Record<AnilloEEF, Record<Hora, [string, CodigoRegion[]]>> = {
  TV: {
    12: ['anterior', ['RA_RAL']],
    1: ['anteroseptal', ['AS_RAPS']],
    2: ['anteroseptal / parahisiana', ['AS_RAPS']],
    3: ['medioseptal', ['MSTA']],
    4: ['medioseptal posterior', ['MSTA', 'PSTA', 'PSTA_CSOS']],
    5: ['posteroseptal', ['PSTA', 'PSTA_CSOS']],
    6: ['posterior', ['RP_RPL']],
    7: ['posterior', ['RP_RPL']],
    8: ['lateral posterior', ['RP_RPL']],
    9: ['lateral anterior', ['RL', 'RA_RAL']],
    10: ['lateral anterior', ['RA_RAL']],
    11: ['anterior', ['RA_RAL']],
  },
  MV: {
    12: ['septal anterior (continuidad mitroaórtica)', []],
    1: ['lateral', ['LL_LAL']],
    2: ['lateral', ['LL_LAL']],
    3: ['lateral', ['LL_LAL']],
    4: ['posterolateral alta', ['LP_LPL']],
    5: ['posterolateral baja', ['LP_LPL']],
    6: ['posterior y posteroseptal', ['PSMA', 'LP_LPL']],
    7: ['posterior y posteroseptal', ['PSMA', 'LP_LPL']],
    8: ['posteroseptal', ['PSMA']],
    9: ['septal', []],
    10: ['septal anterior (continuidad mitroaórtica)', []],
    11: ['septal anterior (continuidad mitroaórtica)', []],
  },
};

export const sectorHora = (anillo: AnilloEEF, hora: Hora) => SECTORES[anillo][hora][0];

const LOCALIZACIONES_HORA: LocalizacionEEF[] = (['TV', 'MV'] as AnilloEEF[]).flatMap((anillo) =>
  HORAS.map((hora) => ({
    codigo: `${anillo}_${hora}` as CodigoHora,
    nombre: `${NOMBRES_ANILLO[anillo]} ${ROMANOS[hora]} (${SECTORES[anillo][hora][0]})`,
    grupo: `Anillo ${NOMBRES_ANILLO[anillo].toLowerCase()}`,
    compatibles: SECTORES[anillo][hora][1],
    evaluable: true,
    anillo,
    hora,
  })),
);

export const LOCALIZACIONES_EEF: LocalizacionEEF[] = [
  ...LOCALIZACIONES_HORA,
  L('LAL', 'Anterolateral izquierda', 'Pared libre izquierda (anillo mitral)', ['LL_LAL']),
  L('LL', 'Lateral izquierda', 'Pared libre izquierda (anillo mitral)', ['LL_LAL']),
  L('LPL', 'Posterolateral izquierda', 'Pared libre izquierda (anillo mitral)', ['LP_LPL']),
  L('LP', 'Posterior izquierda', 'Pared libre izquierda (anillo mitral)', ['LP_LPL']),
  L('PSMA', 'Posteroseptal mitral (izquierda)', 'Septal', ['PSMA']),
  L('AS_PH', 'Anteroseptal / parahisiana', 'Septal', ['AS_RAPS']),
  L('MS', 'Medioseptal', 'Septal', ['MSTA']),
  L('PSTA', 'Posteroseptal tricuspídea (derecha)', 'Septal', ['PSTA_CSOS', 'PSTA']),
  L('CSOS', 'Región del ostium del seno coronario (endocárdica)', 'Septal', ['PSTA_CSOS']),
  L('PS_SUBEPI', 'Posteroseptal subepicárdica (seno coronario, vena cardíaca media o divertículo)', 'Otras situaciones', ['PS_SUBEPI'], false),
  L('RA', 'Anterior derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RA_RAL']),
  L('RAL', 'Anterolateral derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RA_RAL']),
  L('RL', 'Lateral derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RL']),
  L('RPL', 'Posterolateral derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RP_RPL']),
  L('RP', 'Posterior derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RP_RPL']),
  L('MULTIPLES', 'Vías accesorias múltiples', 'Otras situaciones', [], false),
  L('NO_LOCALIZADA', 'No localizada / estudio no concluyente', 'Otras situaciones', [], false),
];

/** Situaciones sin hora que se ofrecen hoy para cargar. */
export const OTRAS_SITUACIONES: CodigoEEF[] = ['PS_SUBEPI', 'MULTIPLES', 'NO_LOCALIZADA'];

/** Equivalencia aproximada de los códigos anteriores con el reloj (para editar registros viejos). */
export const LEGADO_A_HORA: Record<CodigoEEFLegado, CodigoHora> = {
  LAL: 'MV_1', LL: 'MV_2', LPL: 'MV_4', LP: 'MV_6', PSMA: 'MV_8',
  AS_PH: 'TV_1', MS: 'TV_3', PSTA: 'TV_5', CSOS: 'TV_5',
  RA: 'TV_11', RAL: 'TV_10', RL: 'TV_9', RPL: 'TV_8', RP: 'TV_7',
};

/** Horas que abarca cada región de los algoritmos sobre su anillo. */
const HORAS_REGION: Partial<Record<CodigoRegion, { anillo: AnilloEEF; horas: Hora[] }>> = {
  RA_RAL: { anillo: 'TV', horas: [9, 10, 11, 12] },
  AS_RAPS: { anillo: 'TV', horas: [1, 2] },
  MSTA: { anillo: 'TV', horas: [3, 4] },
  PSTA: { anillo: 'TV', horas: [4, 5] },
  PSTA_CSOS: { anillo: 'TV', horas: [4, 5] },
  RP_RPL: { anillo: 'TV', horas: [6, 7, 8] },
  RL: { anillo: 'TV', horas: [9] },
  LL_LAL: { anillo: 'MV', horas: [1, 2, 3] },
  LP_LPL: { anillo: 'MV', horas: [4, 5, 6, 7] },
  PSMA: { anillo: 'MV', horas: [6, 7, 8] },
};

/**
 * Distancia en horas entre la predicción y el sitio confirmado, sobre el mismo anillo
 * (0 = la hora confirmada está dentro de la región predicha). null si no es comparable
 * (otro anillo, sitio sin hora o región sin horas definidas). Con dos regiones, la menor.
 */
export function distanciaHoras(regiones: readonly string[], localizacion: CodigoEEF): number | null {
  const sitio = POR_CODIGO_EEF[localizacion];
  if (!sitio?.anillo || !sitio.hora) return null;
  let mejor: number | null = null;
  for (const r of regiones) {
    const h = HORAS_REGION[r as CodigoRegion];
    if (!h || h.anillo !== sitio.anillo) continue;
    for (const x of h.horas) {
      const d = Math.abs(x - sitio.hora);
      const circ = Math.min(d, 12 - d);
      if (mejor === null || circ < mejor) mejor = circ;
    }
  }
  return mejor;
}

export const POR_CODIGO_EEF = Object.fromEntries(LOCALIZACIONES_EEF.map((l) => [l.codigo, l])) as Record<
  CodigoEEF,
  LocalizacionEEF
>;

export const NOMBRES_FUENTE: Record<FuenteEEF, string> = {
  ablacion_exitosa: 'Sitio de ablación exitosa',
  mapeo_sin_ablacion: 'Mapeo, sin ablación exitosa',
};

/**
 * - concordante: la región predicha corresponde al sitio confirmado.
 * - parcial: el algoritmo dio dos opciones (PSTA o PSMA) y una corresponde.
 * - discordante: hubo predicción y no corresponde.
 * - sin_prediccion: el algoritmo no dio región (indeterminado, incompleto, etc.).
 * - no_evaluable: vías múltiples o sin localización confirmada.
 */
export type Concordancia = 'concordante' | 'parcial' | 'discordante' | 'sin_prediccion' | 'no_evaluable';

export const NOMBRES_CONCORDANCIA: Record<Concordancia, string> = {
  concordante: 'Coincide',
  parcial: 'Coincide una de dos opciones',
  discordante: 'No coincide',
  sin_prediccion: 'Sin predicción del algoritmo',
  no_evaluable: 'No evaluable',
};

export function evaluarConcordancia(regionesPredichas: readonly string[], localizacion: CodigoEEF): Concordancia {
  const sitio = POR_CODIGO_EEF[localizacion];
  if (!sitio || !sitio.evaluable) return 'no_evaluable';
  if (regionesPredichas.length === 0) return 'sin_prediccion';
  const aciertos = regionesPredichas.filter((r) => (sitio.compatibles as string[]).includes(r)).length;
  if (aciertos === 0) return 'discordante';
  return regionesPredichas.length > 1 ? 'parcial' : 'concordante';
}

export interface DatosEEF {
  localizacion: CodigoEEF;
  /** Anillo y hora del sitio confirmado (si se cargó con el reloj). */
  anillo?: AnilloEEF;
  hora?: Hora;
  fuente: FuenteEEF | null;
  /** Concordancia del algoritmo principal del análisis. */
  concordancia: Concordancia;
  /** Concordancia de cada algoritmo calculado sobre el mismo ECG. */
  concordancias?: Partial<Record<CodigoAlgoritmo, Concordancia>>;
  /** Distancia en horas entre la predicción principal y el sitio (si es comparable). */
  distanciaHoras?: number | null;
  /** Distancia en horas de cada algoritmo. */
  distancias?: Partial<Record<CodigoAlgoritmo, number | null>>;
}

export function construirEEF(
  regionesPredichas: readonly string[],
  localizacion: CodigoEEF,
  fuente: FuenteEEF | null,
  predicciones?: Partial<Record<CodigoAlgoritmo, readonly string[]>>,
): DatosEEF {
  const sitio = POR_CODIGO_EEF[localizacion];
  const datos: DatosEEF = { localizacion, fuente, concordancia: evaluarConcordancia(regionesPredichas, localizacion) };
  if (sitio?.anillo && sitio.hora) {
    datos.anillo = sitio.anillo;
    datos.hora = sitio.hora;
    datos.distanciaHoras = distanciaHoras(regionesPredichas, localizacion);
  }
  if (predicciones && Object.keys(predicciones).length > 0) {
    datos.concordancias = Object.fromEntries(
      Object.entries(predicciones).map(([alg, regs]) => [alg, evaluarConcordancia(regs ?? [], localizacion)]),
    ) as Partial<Record<CodigoAlgoritmo, Concordancia>>;
    if (datos.hora) {
      datos.distancias = Object.fromEntries(
        Object.entries(predicciones).map(([alg, regs]) => [alg, distanciaHoras(regs ?? [], localizacion)]),
      ) as Partial<Record<CodigoAlgoritmo, number | null>>;
    }
  }
  return datos;
}

// --- Código de registro ------------------------------------------------------

/** Sin 0/O, 1/I/L para que se pueda dictar y copiar a mano sin errores. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generarCodigo(aleatorio: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = aleatorio(6);
  let s = '';
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return `WPW-${s}`;
}

/** Normaliza lo que escribe el usuario: mayúsculas, sin espacios, con prefijo. */
export function normalizarCodigo(texto: string): string | null {
  const t = texto.toUpperCase().replace(/[\s_]/g, '').replace(/^WPW-?/, '');
  if (!/^[2-9A-HJKMNP-Z]{6}$/.test(t)) return null;
  return `WPW-${t}`;
}
