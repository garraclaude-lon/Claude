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
}
