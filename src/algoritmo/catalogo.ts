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
    abreviatura: 'LL/LAL',
    descripcion: 'Izquierda lateral o anterolateral',
    grupo: 'Pared libre izquierda',
  },
  LP_LPL: {
    codigo: 'LP_LPL',
    abreviatura: 'LP/LPL',
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
    abreviatura: 'PSTA/CSOs',
    descripcion:
      'Anillo tricuspídeo posteroseptal o región del ostium del seno coronario y sus alrededores',
    grupo: 'Septal',
  },
  PSTA: {
    codigo: 'PSTA',
    abreviatura: 'PSTA',
    descripcion: 'Anillo tricuspídeo posteroseptal',
    grupo: 'Septal',
  },
  PSMA: {
    codigo: 'PSMA',
    abreviatura: 'PSMA',
    descripcion: 'Anillo mitral posteroseptal',
    grupo: 'Septal',
  },
  AS_RAPS: {
    codigo: 'AS_RAPS',
    abreviatura: 'AS/RAPS',
    descripcion: 'Región anteroseptal o anillo tricuspídeo paraseptal anterior derecho',
    grupo: 'Septal',
  },
  MSTA: {
    codigo: 'MSTA',
    abreviatura: 'MSTA',
    descripcion: 'Anillo tricuspídeo medioseptal',
    grupo: 'Septal',
  },
  RA_RAL: {
    codigo: 'RA_RAL',
    abreviatura: 'RA/RAL',
    descripcion: 'Derecha anterior o anterolateral',
    grupo: 'Pared libre derecha',
  },
  RL: {
    codigo: 'RL',
    abreviatura: 'RL',
    descripcion: 'Derecha lateral',
    grupo: 'Pared libre derecha',
  },
  RP_RPL: {
    codigo: 'RP_RPL',
    abreviatura: 'RP/RPL',
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
};
