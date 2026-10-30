/**
 * Implementación determinista del algoritmo de Arruda (1998) para estimar la
 * localización de la vía accesoria en el síndrome de Wolff-Parkinson-White.
 *
 * Las reglas siguen la especificación del proyecto (ver docs/ALGORITMO.md).
 * Deben revisarse contra la publicación original antes de cualquier uso
 * asistencial (ver docs/LIMITACIONES.md).
 *
 * Principios:
 * - Un dato no ingresado (`null`) nunca se trata como positivo, negativo ni isoeléctrico.
 * - Solo se exigen los datos necesarios para la rama que se está recorriendo.
 * - Si las reglas no permiten decidir, no se inventa una localización.
 */
import { NOMBRES_VALORES, REFERENCIA_ARRUDA, REGIONES, VERSION_ALGORITMO } from './catalogo';
import type {
  CampoECG,
  CodigoRegion,
  CriterioUsado,
  EntradaECG,
  EstadoResultado,
  PasoTraza,
  ResultadoArruda,
} from './tipos';

/** Final de la ruta: el paso que termina el recorrido. */
export interface FinRuta {
  estado: EstadoResultado;
  regiones: CodigoRegion[];
  mensaje: string;
  datosFaltantes: CampoECG[];
}

export interface SalidaPaso {
  traza: PasoTraza;
  /** Presente si el paso termina el recorrido; ausente si continúa al siguiente. */
  fin?: FinRuta;
}

export const ENTRADA_VACIA: EntradaECG = {
  deltaI: null,
  deltaII: null,
  deltaAVF: null,
  deltaV1: null,
  deltaAVR: null,
  rsV1: null,
  rsIII: null,
};

function criterio(entrada: EntradaECG, campo: CampoECG): CriterioUsado {
  return { campo, valor: entrada[campo] ?? 'sin_dato' };
}

function txt(valor: string | null): string {
  return NOMBRES_VALORES[valor ?? 'sin_dato'] ?? String(valor);
}

function faltante(campo: CampoECG, nombre: string): FinRuta {
  return {
    estado: 'datos_insuficientes',
    regiones: [],
    mensaje: `Completá ${nombre} para continuar por esta rama.`,
    datosFaltantes: [campo],
  };
}

function noEvaluable(nombre: string): FinRuta {
  return {
    estado: 'indeterminado',
    regiones: [],
    mensaje: `${nombre} fue marcada como no evaluable; las reglas no permiten decidir esta rama.`,
    datosFaltantes: [],
  };
}

function prediccion(regiones: CodigoRegion[], mensaje: string): FinRuta {
  return { estado: 'region_predicha', regiones, mensaje, datosFaltantes: [] };
}

// ---------------------------------------------------------------------------
// Paso 1: pared libre izquierda
// ---------------------------------------------------------------------------
export function paso1(e: EntradaECG): SalidaPaso {
  const titulo = 'Paso 1 — Pared libre izquierda';
  const pregunta = '¿Onda delta en I negativa o isoeléctrica, o R > S en V1?';
  const iCumple = e.deltaI === 'negativa' || e.deltaI === 'isoelectrica';
  const v1Cumple = e.rsV1 === 'r_mayor_s';

  if (iCumple || v1Cumple) {
    const motivos: string[] = [];
    const criterios: CriterioUsado[] = [];
    if (iCumple) {
      motivos.push(`delta en I ${txt(e.deltaI)}`);
      criterios.push(criterio(e, 'deltaI'));
    }
    if (v1Cumple) {
      motivos.push('R > S en V1');
      criterios.push(criterio(e, 'rsV1'));
    }
    criterios.push(criterio(e, 'deltaAVF'));
    const base = `Sí (${motivos.join(' y ')}): vía de pared libre izquierda. Se evalúa aVF`;

    let fin: FinRuta;
    let decision: string;
    switch (e.deltaAVF) {
      case 'positiva':
        decision = `${base}: positiva → región IL/IAL.`;
        fin = prediccion(['LL_LAL'], 'Pared libre izquierda con delta en aVF positiva.');
        break;
      case 'negativa':
      case 'isoelectrica':
        decision = `${base}: ${txt(e.deltaAVF)} → región IP/IPL.`;
        fin = prediccion(['LP_LPL'], `Pared libre izquierda con delta en aVF ${txt(e.deltaAVF)}.`);
        break;
      case 'no_evaluable':
        decision = `${base}: no evaluable → no se puede subclasificar.`;
        fin = noEvaluable('La onda delta en aVF');
        break;
      default:
        decision = `${base}: sin dato → se detiene.`;
        fin = faltante('deltaAVF', 'la polaridad de la onda delta en aVF');
    }
    return {
      traza: { paso: 1, titulo, pregunta, criterios, decision, desenlace: fin.estado === 'region_predicha' ? 'clasifica' : 'detiene' },
      fin,
    };
  }

  const criterios = [criterio(e, 'deltaI'), criterio(e, 'rsV1')];

  if (e.deltaI === 'positiva' && e.rsV1 === 'r_menor_igual_s') {
    return {
      traza: {
        paso: 1, titulo, pregunta, criterios,
        decision: 'No (delta en I positiva y R ≤ S en V1) → continuar al paso 2.',
        desenlace: 'continua',
      },
    };
  }

  // No se puede afirmar ni descartar la condición.
  const faltan: CampoECG[] = [];
  if (e.deltaI === null) faltan.push('deltaI');
  if (e.rsV1 === null) faltan.push('rsV1');
  const fin: FinRuta =
    faltan.length > 0
      ? {
          estado: 'datos_insuficientes',
          regiones: [],
          mensaje:
            'Completá la polaridad de la onda delta en I y/o la relación R/S en V1 para decidir el paso 1.',
          datosFaltantes: faltan,
        }
      : {
          estado: 'indeterminado',
          regiones: [],
          mensaje:
            'Un criterio del paso 1 es no evaluable y el otro no cumple la condición: no se puede descartar ni confirmar pared libre izquierda.',
          datosFaltantes: [],
        };
  return {
    traza: {
      paso: 1, titulo, pregunta, criterios,
      decision: `No se puede decidir (delta en I ${txt(e.deltaI)}, R/S en V1 ${txt(e.rsV1)}) → se detiene.`,
      desenlace: 'detiene',
    },
    fin,
  };
}

// ---------------------------------------------------------------------------
// Paso 2: posteroseptal subepicárdica
// ---------------------------------------------------------------------------
export function paso2(e: EntradaECG): SalidaPaso {
  const titulo = 'Paso 2 — Posteroseptal subepicárdica';
  const pregunta = '¿Onda delta en II negativa?';
  const criterios = [criterio(e, 'deltaII')];
  const traza = (decision: string, desenlace: PasoTraza['desenlace']): PasoTraza => ({
    paso: 2, titulo, pregunta, criterios, decision, desenlace,
  });

  switch (e.deltaII) {
    case 'negativa':
      return {
        traza: traza('Sí (delta en II negativa) → PS subepicárdica (vía posteroseptal subepicárdica).', 'clasifica'),
        fin: prediccion(['PS_SUBEPI'], 'Delta en II negativa.'),
      };
    case 'positiva':
    case 'isoelectrica':
      return { traza: traza(`No (delta en II ${txt(e.deltaII)}) → continuar al paso 3.`, 'continua') };
    case 'no_evaluable':
      return { traza: traza('Delta en II no evaluable → se detiene.', 'detiene'), fin: noEvaluable('La onda delta en II') };
    default:
      return {
        traza: traza('Delta en II sin dato → se detiene.', 'detiene'),
        fin: faltante('deltaII', 'la polaridad de la onda delta en II'),
      };
  }
}

// ---------------------------------------------------------------------------
// Paso 3: vías septales
// ---------------------------------------------------------------------------
export function paso3(e: EntradaECG): SalidaPaso {
  const titulo = 'Paso 3 — Vías septales';
  const pregunta = '¿Onda delta en V1 negativa o isoeléctrica?';
  const criterios: CriterioUsado[] = [criterio(e, 'deltaV1')];
  const traza = (decision: string, fin?: FinRuta): SalidaPaso => ({
    traza: {
      paso: 3, titulo, pregunta, criterios, decision,
      desenlace: !fin ? 'continua' : fin.estado === 'region_predicha' ? 'clasifica' : 'detiene',
    },
    fin,
  });

  if (e.deltaV1 === 'positiva') {
    return traza('No (delta en V1 positiva) → continuar al paso 4.');
  }
  if (e.deltaV1 === 'no_evaluable') {
    return traza('Delta en V1 no evaluable → se detiene.', noEvaluable('La onda delta en V1'));
  }
  if (e.deltaV1 === null) {
    return traza('Delta en V1 sin dato → se detiene.', faltante('deltaV1', 'la polaridad de la onda delta en V1'));
  }

  // V1 negativa o isoeléctrica: vía septal, se examina aVF.
  criterios.push(criterio(e, 'deltaAVF'));
  const base = `Sí (delta en V1 ${txt(e.deltaV1)}): vía septal. Se evalúa aVF`;

  switch (e.deltaAVF) {
    case 'negativa':
      return traza(`${base}: negativa → PST/OSC.`, prediccion(['PSTA_CSOS'], 'Septal con delta en aVF negativa.'));
    case 'isoelectrica':
      return traza(
        `${base}: isoeléctrica → PST o PSM (el algoritmo no discrimina entre ambas).`,
        prediccion(['PSTA', 'PSMA'], 'Septal con delta en aVF isoeléctrica: dos localizaciones posibles.'),
      );
    case 'no_evaluable':
      return traza(`${base}: no evaluable → se detiene.`, noEvaluable('La onda delta en aVF'));
    case null:
      return traza(`${base}: sin dato → se detiene.`, faltante('deltaAVF', 'la polaridad de la onda delta en aVF'));
    case 'positiva':
      break;
  }

  // aVF positiva: se usa la relación R/S en III.
  criterios.push(criterio(e, 'rsIII'));
  const base2 = `${base}: positiva. Se evalúa R/S en III`;
  switch (e.rsIII) {
    case 'r_mayor_s':
      return traza(`${base2}: R > S → AS/PSAD.`, prediccion(['AS_RAPS'], 'Septal, aVF positiva y R > S en III.'));
    case 'r_menor_s':
      return traza(`${base2}: R < S → MST.`, prediccion(['MSTA'], 'Septal, aVF positiva y R < S en III.'));
    case 'iguales':
      return traza(`${base2}: R = S → indeterminado.`, {
        estado: 'indeterminado',
        regiones: [],
        mensaje: 'R = S en III: las reglas especificadas no definen una localización para este caso.',
        datosFaltantes: [],
      });
    case 'no_evaluable':
      return traza(`${base2}: no evaluable → indeterminado.`, noEvaluable('La relación R/S en III'));
    default:
      return traza(`${base2}: sin dato → se detiene.`, faltante('rsIII', 'la relación R/S en III'));
  }
}

// ---------------------------------------------------------------------------
// Paso 4: pared libre derecha
// ---------------------------------------------------------------------------
export function paso4(e: EntradaECG): SalidaPaso {
  const titulo = 'Paso 4 — Pared libre derecha';
  const pregunta = '¿Onda delta en aVR positiva?';
  const criterios: CriterioUsado[] = [criterio(e, 'deltaAVR')];
  const traza = (decision: string, fin: FinRuta): SalidaPaso => ({
    traza: {
      paso: 4, titulo, pregunta, criterios, decision,
      desenlace: fin.estado === 'region_predicha' ? 'clasifica' : 'detiene',
    },
    fin,
  });

  switch (e.deltaAVR) {
    case 'positiva':
      return traza('Sí (delta en aVR positiva) → DA/DAL.', prediccion(['RA_RAL'], 'Delta en aVR positiva.'));
    case 'no_evaluable':
      return traza('Delta en aVR no evaluable → se detiene.', noEvaluable('La onda delta en aVR'));
    case null:
      return traza('Delta en aVR sin dato → se detiene.', faltante('deltaAVR', 'la polaridad de la onda delta en aVR'));
    default:
      break;
  }

  criterios.push(criterio(e, 'deltaII'));
  const base = `No (delta en aVR ${txt(e.deltaAVR)}). Se evalúa II`;
  switch (e.deltaII) {
    case 'positiva':
      return traza(`${base}: positiva → DL.`, prediccion(['RL'], 'aVR no positiva y delta en II positiva.'));
    case 'isoelectrica':
      return traza(`${base}: isoeléctrica → DP/DPL.`, prediccion(['RP_RPL'], 'aVR no positiva y delta en II isoeléctrica.'));
    case 'negativa':
      return traza(`${base}: negativa → no clasificable.`, {
        estado: 'no_clasificable',
        regiones: [],
        mensaje: 'Delta en II negativa en el paso 4: combinación no contemplada por las reglas especificadas.',
        datosFaltantes: [],
      });
    case 'no_evaluable':
      return traza(`${base}: no evaluable → se detiene.`, noEvaluable('La onda delta en II'));
    default:
      return traza(`${base}: sin dato → se detiene.`, faltante('deltaII', 'la polaridad de la onda delta en II'));
  }
}

const PASOS = [paso1, paso2, paso3, paso4];

/** Aplica el algoritmo completo y devuelve el resultado con su trazabilidad. */
export function aplicarArruda(entrada: EntradaECG): ResultadoArruda {
  const ruta: PasoTraza[] = [];
  let fin: FinRuta | undefined;

  for (const paso of PASOS) {
    const salida = paso(entrada);
    ruta.push(salida.traza);
    if (salida.fin) {
      fin = salida.fin;
      break;
    }
  }

  // El paso 4 siempre termina el recorrido; esto es una salvaguarda.
  if (!fin) {
    throw new Error('El algoritmo terminó sin desenlace: error de implementación.');
  }

  const vistos = new Set<CampoECG>();
  const criteriosDeterminantes: CriterioUsado[] = [];
  for (const p of ruta) {
    for (const c of p.criterios) {
      if (!vistos.has(c.campo)) {
        vistos.add(c.campo);
        criteriosDeterminantes.push(c);
      }
    }
  }

  return {
    estado: fin.estado,
    regiones: fin.regiones.map((c) => REGIONES[c]),
    mensaje: fin.mensaje,
    ruta,
    criteriosDeterminantes,
    datosFaltantes: fin.datosFaltantes,
    versionAlgoritmo: VERSION_ALGORITMO,
    referencia: REFERENCIA_ARRUDA,
  };
}
