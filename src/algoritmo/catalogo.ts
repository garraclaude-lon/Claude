import type { CampoECG, CodigoRegion, RegionAnatomica } from './tipos';

export const VERSION_ALGORITMO = 'arruda-1998-impl-0.1.0';

/**
 * Cita bibliográfica. Debe verificarse contra la publicación original
 * (ver docs/LIMITACIONES.md).
 */
export const REFERENCIA_ARRUDA =
  'Arruda MS, McClelland JH, Wang X, Beckman KJ, Widman LE, Gonzalez MD, Nakagawa H, ' +
  'Lazzara R, Jackman WM. Development and validation of an ECG algorithm for identifying ' +
  'accessory pathway ablation site in Wolff-Parkinson-White syndrome. ' +
  'J Cardiovasc Electrophysiol. 1998;9(1):2-12.';

export const REGIONES: Record<CodigoRegion, RegionAnatomica> = {
  LL_LAL: {
    codigo: 'LL_LAL',
    abreviatura: 'IL/IAL',
    descripcion: 'Izquierda lateral o anterolateral',
    grupo: 'Pared libre izquierda',
  },
  LP_LPL: {
    codigo: 'LP_LPL',
    abreviatura: 'IP/IPL',
    descripcion: 'Izquierda posterior o posterolateral',
    grupo: 'Pared libre izquierda',
  },
  PS_SUBEPI: {
    codigo: 'PS_SUBEPI',
    abreviatura: 'PS subepicárdica',
    descripcion: 'Vía posteroseptal subepicárdica',
    grupo: 'Posteroseptal subepicárdica',
    abreviaturaInterna: true,
  },
  PSTA_CSOS: {
    codigo: 'PSTA_CSOS',
    abreviatura: 'PST/OSC',
    descripcion:
      'Anillo tricuspídeo posteroseptal o región del ostium del seno coronario y sus alrededores',
    grupo: 'Septal',
  },
  PSTA: {
    codigo: 'PSTA',
    abreviatura: 'PST',
    descripcion: 'Anillo tricuspídeo posteroseptal',
    grupo: 'Septal',
  },
  PSMA: {
    codigo: 'PSMA',
    abreviatura: 'PSM',
    descripcion: 'Anillo mitral posteroseptal',
    grupo: 'Septal',
  },
  AS_RAPS: {
    codigo: 'AS_RAPS',
    abreviatura: 'AS/PSAD',
    descripcion: 'Región anteroseptal o paraseptal anterior derecha',
    grupo: 'Septal',
  },
  MSTA: {
    codigo: 'MSTA',
    abreviatura: 'MST',
    descripcion: 'Anillo tricuspídeo medioseptal',
    grupo: 'Septal',
  },
  RA_RAL: {
    codigo: 'RA_RAL',
    abreviatura: 'DA/DAL',
    descripcion: 'Derecha anterior o anterolateral',
    grupo: 'Pared libre derecha',
  },
  RL: {
    codigo: 'RL',
    abreviatura: 'DL',
    descripcion: 'Derecha lateral',
    grupo: 'Pared libre derecha',
  },
  RP_RPL: {
    codigo: 'RP_RPL',
    abreviatura: 'DP/DPL',
    descripcion: 'Derecha posterior o posterolateral',
    grupo: 'Pared libre derecha',
  },
};

export const NOMBRES_CAMPOS: Record<CampoECG, string> = {
  deltaI: 'Onda delta en I',
  deltaII: 'Onda delta en II',
  deltaAVF: 'Onda delta en aVF',
  deltaV1: 'Onda delta en V1',
  deltaAVR: 'Onda delta en aVR',
  rsV1: 'Relación R/S en V1',
  rsIII: 'Relación R/S en III',
  qrsV1: 'Polaridad del QRS en V1',
  transicionQRS: 'Transición del QRS en precordiales',
  deltaMasPositiva: 'Derivación con la onda delta más positiva',
};

export const NOMBRES_VALORES: Record<string, string> = {
  positiva: 'positiva',
  negativa: 'negativa',
  isoelectrica: 'isoeléctrica',
  no_evaluable: 'no evaluable',
  r_mayor_s: 'R > S',
  r_menor_igual_s: 'R ≤ S',
  r_menor_s: 'R < S',
  iguales: 'R = S',
  sin_dato: 'sin dato',
  hasta_v3: 'hasta V3',
  v4_o_despues: 'V4 o después',
  ii: 'II',
  iii: 'III',
  avr: 'aVR',
  avl: 'aVL',
  empate: 'empate entre derivaciones',
};

export const VERSION_EASY_WPW = 'easy-wpw-2023-impl-0.1.0';

export const REFERENCIA_EASY_WPW =
  'El Hamriti M, Braun M, Molatta S, Imnadze G, Khalaph M, Lucas P, et al. EASY-WPW: a novel ' +
  'ECG-algorithm for easy and reliable localization of manifest accessory pathways in children ' +
  'and adults. Europace. 2023;25(2):600-9.';

export const NOMBRES_ALGORITMO: Record<'arruda' | 'easy_wpw', string> = {
  arruda: 'Arruda (1998)',
  easy_wpw: 'EASY-WPW (2023)',
};
