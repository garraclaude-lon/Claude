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
  // La derivación se ve en el recuadro de la pregunta.
  pregunta: '¿Cómo es la polaridad (+ o -) de la onda Delta?',
  ayuda: AYUDA_DELTA,
  opciones: OPCIONES_POLARIDAD,
});

export const CAMPOS: Record<CampoECG, DefCampo> = {
  // DI: rótulo pedido por el equipo de EEF
  deltaI: { ...delta('deltaI', 'I'), derivacion: 'DI' },
  deltaII: delta('deltaII', 'II'),
  deltaAVR: delta('deltaAVR', 'aVR'),
  deltaAVF: delta('deltaAVF', 'aVF'),
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
  // --- EASY-WPW
  qrsV1: {
    campo: 'qrsV1',
    derivacion: 'V1',
    etiqueta: 'Polaridad del QRS en V1',
    pregunta: '¿Cómo es la polaridad (+ o -) del QRS en V1?',
    ayuda: 'Polaridad predominante del complejo QRS en V1: más área por encima (positiva) o por debajo (negativa) de la línea de base; isoeléctrica si es isodifásico.',
    opciones: [
      { valor: 'positiva', etiqueta: 'Positiva' },
      { valor: 'negativa', etiqueta: 'Negativa' },
      { valor: 'isoelectrica', etiqueta: 'Isoeléctrica' },
      { valor: 'no_evaluable', etiqueta: 'No evaluable' },
    ],
  },
  transicionQRS: {
    campo: 'transicionQRS',
    derivacion: 'V1–V6',
    etiqueta: 'Transición del QRS en precordiales',
    pregunta: '¿Dónde ocurre la transición del QRS en precordiales?',
    ayuda: 'Primera derivación precordial en la que la onda R es mayor que la S.',
    opciones: [
      { valor: 'hasta_v3', etiqueta: 'Hasta V3' },
      { valor: 'v4_o_despues', etiqueta: 'V4 o después' },
      { valor: 'no_evaluable', etiqueta: 'No evaluable' },
    ],
  },
  deltaMasPositiva: {
    campo: 'deltaMasPositiva',
    derivacion: 'Δ+',
    etiqueta: 'Derivación con la onda delta más positiva',
    pregunta: '¿En qué derivación la onda Delta es más positiva?',
    ayuda: 'Compará la onda delta en II, III, aVR y aVL y elegí la más positiva. Si la delta no se distingue bien, usá el QRS más positivo.',
    opciones: [
      { valor: 'ii', etiqueta: 'II' },
      { valor: 'iii', etiqueta: 'III' },
      { valor: 'avr', etiqueta: 'aVR' },
      { valor: 'avl', etiqueta: 'aVL' },
      { valor: 'empate', etiqueta: 'Empate' },
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
