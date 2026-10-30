/**
 * Tipos de datos del algoritmo de Arruda (1998).
 * Este módulo no depende de React: puede usarse y probarse por separado.
 */

/** Polaridad de los primeros 20 ms de la onda delta. `null` = dato no ingresado. */
export type Polaridad = 'positiva' | 'negativa' | 'isoelectrica' | 'no_evaluable';

/** Relación de amplitud R/S en V1. */
export type RelacionRSV1 = 'r_mayor_s' | 'r_menor_igual_s' | 'no_evaluable';

/** Relación de amplitud R/S en III. */
export type RelacionRSIII = 'r_mayor_s' | 'r_menor_s' | 'iguales' | 'no_evaluable';

/** Transición del QRS en precordiales (derivación donde R pasa a ser mayor que S). */
export type TransicionQRS = 'hasta_v3' | 'v4_o_despues' | 'no_evaluable';

/** Derivación, entre II, III, aVR y aVL, con la onda delta más positiva (EASY-WPW). */
export type DeltaMasPositiva = 'ii' | 'iii' | 'avr' | 'avl' | 'empate' | 'no_evaluable';

/**
 * Datos de entrada. Cada campo puede ser `null` cuando el usuario todavía
 * no lo completó. Un `null` NUNCA se interpreta como un valor clínico.
 */
export interface EntradaECG {
  deltaI: Polaridad | null;
  deltaII: Polaridad | null;
  deltaAVF: Polaridad | null;
  deltaV1: Polaridad | null;
  deltaAVR: Polaridad | null;
  rsV1: RelacionRSV1 | null;
  rsIII: RelacionRSIII | null;
  /** EASY-WPW: polaridad predominante del QRS en V1. */
  qrsV1: Polaridad | null;
  /** EASY-WPW (y EPM): transición del QRS en precordiales. */
  transicionQRS: TransicionQRS | null;
  /** EASY-WPW: derivación con la onda delta más positiva. */
  deltaMasPositiva: DeltaMasPositiva | null;
  /** SMART-WPW: polaridad de la onda delta en III. */
  deltaIII: Polaridad | null;
  /** SMART-WPW: polaridad predominante del QRS en V3. */
  qrsV3: Polaridad | null;
}

export type CampoECG = keyof EntradaECG;

/**
 * Estado del resultado:
 * - region_predicha: las reglas llevan a una (o dos) regiones anatómicas.
 * - datos_insuficientes: falta completar un dato necesario para la rama.
 * - indeterminado: el dato está cargado ("no evaluable", R = S en III, etc.)
 *   pero las reglas no permiten decidir.
 * - no_clasificable: la combinación no está contemplada por las reglas.
 */
export type EstadoResultado =
  | 'region_predicha'
  | 'datos_insuficientes'
  | 'indeterminado'
  | 'no_clasificable';

export type CodigoRegion =
  | 'LL_LAL'
  | 'LP_LPL'
  | 'PS_SUBEPI'
  | 'PSTA_CSOS'
  | 'PSTA'
  | 'PSMA'
  | 'AS_RAPS'
  | 'MSTA'
  | 'RA_RAL'
  | 'RL'
  | 'RP_RPL';

export interface RegionAnatomica {
  codigo: CodigoRegion;
  /** Abreviatura que se muestra al usuario. */
  abreviatura: string;
  descripcion: string;
  grupo: string;
  /** true si la abreviatura es propia de esta implementación y no del artículo. */
  abreviaturaInterna?: boolean;
}

export interface CriterioUsado {
  campo: CampoECG;
  valor: string; // valor ingresado (o "sin dato")
}

export type DesenlacePaso = 'continua' | 'clasifica' | 'detiene';

export interface PasoTraza {
  paso: 1 | 2 | 3 | 4;
  titulo: string;
  pregunta: string;
  criterios: CriterioUsado[];
  decision: string;
  desenlace: DesenlacePaso;
}

/** Algoritmos implementados. */
export type CodigoAlgoritmo = 'arruda' | 'easy_wpw' | 'smart_wpw';

/** Sector del reloj de los anillos (vista OAI, XII arriba), como lo predice SMART-WPW. */
export interface SectorHorario {
  anillo: 'TV' | 'MV';
  /** Horas del sector (1 a 12). */
  horas: number[];
  /** Sigla del artículo (A, LA, LP, P, PS, MSP, MS, AS, L, HPL, LPL, P&PS). */
  sigla: string;
  nombre: string;
}

export interface ResultadoArruda {
  estado: EstadoResultado;
  /** Regiones predichas (vacío si no hay predicción; 2 si el algoritmo no discrimina). */
  regiones: RegionAnatomica[];
  mensaje: string;
  ruta: PasoTraza[];
  /** Criterios de la rama final (todos los consultados en la ruta). */
  criteriosDeterminantes: CriterioUsado[];
  datosFaltantes: CampoECG[];
  versionAlgoritmo: string;
  referencia: string;
  /** Algoritmo que produjo el resultado (ausente = Arruda, por compatibilidad). */
  algoritmo?: CodigoAlgoritmo;
  /** Nombres de los pasos del algoritmo, para el indicador de avance. */
  nombresPasos?: string[];
  /** Sector horario predicho (algoritmos que localizan por hora del reloj). */
  sector?: SectorHorario;
}

/** Resultado de cualquier algoritmo (misma forma que el de Arruda). */
export type ResultadoAlgoritmo = ResultadoArruda;
