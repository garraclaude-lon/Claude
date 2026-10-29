import type { CampoECG } from '../algoritmo/tipos';

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export interface DefCampo {
  campo: CampoECG;
  derivacion: string;
  etiqueta: string;
  /** Pregunta que hace el asistente guiado. */
  pregunta: string;
  ayuda: string;
  opciones: Opcion[];
}

export interface DefDerivacion {
  derivacion: string;
  campos: DefCampo[];
}

const OPCIONES_POLARIDAD: Opcion[] = [
  { valor: 'positiva', etiqueta: 'Positiva' },
  { valor: 'negativa', etiqueta: 'Negativa' },
  { valor: 'isoelectrica', etiqueta: 'Isoeléctrica' },
  { valor: 'no_evaluable', etiqueta: 'No evaluable' },
];

const AYUDA_DELTA = 'Polaridad inicial de la onda delta (primeros 20 ms).';

const delta = (campo: CampoECG, derivacion: string): DefCampo => ({
  campo,
  derivacion,
  etiqueta: `Onda delta en ${derivacion}`,
  pregunta: `¿Cómo es la onda delta en ${derivacion} durante sus primeros 20 ms?`,
  ayuda: AYUDA_DELTA,
  opciones: OPCIONES_POLARIDAD,
});

export const CAMPOS: Record<CampoECG, DefCampo> = {
  // DI: rótulo y pregunta pedidos por el equipo de EEF
  deltaI: { ...delta('deltaI', 'I'), derivacion: 'DI', pregunta: '¿Cómo es la polaridad (+ o -) de la onda Delta?' },
  deltaII: delta('deltaII', 'II'),
  deltaAVR: delta('deltaAVR', 'aVR'),
  deltaAVF: { ...delta('deltaAVF', 'aVF'), pregunta: '¿Cómo es la polaridad de la onda Delta?' },
  deltaV1: delta('deltaV1', 'V1'),
  rsIII: {
    campo: 'rsIII',
    derivacion: 'III',
    etiqueta: 'Relación R/S en III',
    pregunta: '¿Cómo es la amplitud de la onda R respecto de la onda S en III?',
    ayuda: 'Amplitud de la onda R comparada con la onda S del QRS en III.',
    opciones: [
      { valor: 'r_mayor_s', etiqueta: 'R > S' },
      { valor: 'r_menor_s', etiqueta: 'R < S' },
      { valor: 'iguales', etiqueta: 'R = S' },
      { valor: 'no_evaluable', etiqueta: 'No evaluable' },
    ],
  },
  rsV1: {
    campo: 'rsV1',
    derivacion: 'V1',
    etiqueta: 'Relación R/S en V1',
    pregunta: '¿Cómo es la amplitud de la onda R respecto de la onda S en V1?',
    ayuda: 'Amplitud de la onda R comparada con la onda S del QRS en V1.',
    opciones: [
      { valor: 'r_mayor_s', etiqueta: 'R > S' },
      { valor: 'r_menor_igual_s', etiqueta: 'R ≤ S' },
      { valor: 'no_evaluable', etiqueta: 'No evaluable' },
    ],
  },
};

/** Formulario ordenado por derivación: I, II, III, aVR, aVF, V1. */
export const DERIVACIONES: DefDerivacion[] = [
  { derivacion: 'I', campos: [CAMPOS.deltaI] },
  { derivacion: 'II', campos: [CAMPOS.deltaII] },
  { derivacion: 'III', campos: [CAMPOS.rsIII] },
  { derivacion: 'aVR', campos: [CAMPOS.deltaAVR] },
  { derivacion: 'aVF', campos: [CAMPOS.deltaAVF] },
  { derivacion: 'V1', campos: [CAMPOS.deltaV1, CAMPOS.rsV1] },
];
