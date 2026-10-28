/**
 * Lectura automática EXPERIMENTAL de la imagen del ECG con Claude.
 *
 * La IA solo PROPONE valores. Ningún valor propuesto entra al algoritmo
 * hasta que el profesional lo confirma en la revisión guiada.
 *
 * Solo funciona en la versión publicada en claude.ai (capacidad `sample`
 * con imágenes). En cualquier otro entorno `obtenerLectorClaude()` devuelve
 * null y la app sigue con la revisión manual.
 */
import type { CampoECG, EntradaECG } from '../algoritmo/tipos';
import { ENTRADA_VACIA } from '../algoritmo/arruda';

export type CalidadImagen = 'buena' | 'regular' | 'mala' | null;

export interface PropuestaIA {
  valores: EntradaECG;
  comentarios: Partial<Record<CampoECG, string>>;
  calidad: CalidadImagen;
  esECG: boolean | null;
  observacionGeneral: string;
}

export interface LectorIA {
  leer(imagen: Blob, signal?: AbortSignal): Promise<PropuestaIA>;
}

const VALORES_POLARIDAD = ['positiva', 'negativa', 'isoelectrica', 'no_evaluable'];

const VALORES_PERMITIDOS: Record<CampoECG, string[]> = {
  deltaI: VALORES_POLARIDAD,
  deltaII: VALORES_POLARIDAD,
  deltaAVF: VALORES_POLARIDAD,
  deltaV1: VALORES_POLARIDAD,
  deltaAVR: VALORES_POLARIDAD,
  rsV1: ['r_mayor_s', 'r_menor_igual_s', 'no_evaluable'],
  rsIII: ['r_mayor_s', 'r_menor_s', 'iguales', 'no_evaluable'],
};

export const PROMPT_LECTURA = `Sos un asistente para un proyecto de INVESTIGACIÓN en electrofisiología pediátrica. La imagen debería ser un electrocardiograma de 12 derivaciones con preexcitación ventricular (patrón de Wolff-Parkinson-White).

Tu tarea es solo DESCRIBIR lo que se ve, para que un profesional lo revise y confirme. No des diagnóstico ni localización.

Para cada criterio indicá el valor observado:
- deltaI, deltaII, deltaAVF, deltaV1, deltaAVR: polaridad de los PRIMEROS 20 ms de la onda delta, desde su inicio más temprano identificable. Valores: "positiva", "negativa", "isoelectrica" o "no_evaluable". Una onda que comienza isoeléctrica y luego se vuelve negativa NO debe clasificarse como "negativa".
- rsV1: relación de amplitud R/S del QRS en V1. Valores: "r_mayor_s", "r_menor_igual_s" o "no_evaluable".
- rsIII: relación de amplitud R/S del QRS en III. Valores: "r_mayor_s", "r_menor_s", "iguales" o "no_evaluable".

Reglas:
- Si una derivación no se ve, no está rotulada, está cortada o no podés distinguirla con seguridad, respondé "no_evaluable". No adivines.
- Si la imagen no es un ECG, respondé "esECG": false y todos los valores "no_evaluable".
- No transcribas nombres, documentos ni otros datos personales que aparezcan en la imagen.

Respondé SOLO con un objeto JSON con esta forma exacta:
{"esECG": true, "calidad": "buena" | "regular" | "mala", "deltaI": "...", "deltaII": "...", "deltaAVF": "...", "deltaV1": "...", "deltaAVR": "...", "rsV1": "...", "rsIII": "...", "comentarios": {"deltaI": "frase breve sobre lo observado", "...": "..."}, "observacionGeneral": "una o dos frases sobre la calidad y limitaciones de la imagen"}`;

/** Valida la respuesta de la IA. Todo valor fuera de lo permitido queda como null. */
export function interpretarRespuestaIA(respuesta: unknown): PropuestaIA {
  const obj = respuesta && typeof respuesta === 'object' && !Array.isArray(respuesta)
    ? (respuesta as Record<string, unknown>)
    : {};
  const valores: EntradaECG = { ...ENTRADA_VACIA };
  const comentarios: Partial<Record<CampoECG, string>> = {};
  const comentariosCrudos =
    obj.comentarios && typeof obj.comentarios === 'object' ? (obj.comentarios as Record<string, unknown>) : {};

  for (const campo of Object.keys(VALORES_PERMITIDOS) as CampoECG[]) {
    const v = obj[campo];
    if (typeof v === 'string' && VALORES_PERMITIDOS[campo].includes(v)) {
      (valores as Record<CampoECG, string | null>)[campo] = v;
    }
    const c = comentariosCrudos[campo];
    if (typeof c === 'string' && c.trim()) comentarios[campo] = c.trim().slice(0, 300);
  }

  const esECG = typeof obj.esECG === 'boolean' ? obj.esECG : null;
  if (esECG === false) {
    for (const campo of Object.keys(valores) as CampoECG[]) {
      (valores as Record<CampoECG, string | null>)[campo] = 'no_evaluable';
    }
  }

  const calidad = (['buena', 'regular', 'mala'] as const).find((c) => c === obj.calidad) ?? null;
  const observacionGeneral =
    typeof obj.observacionGeneral === 'string' ? obj.observacionGeneral.trim().slice(0, 600) : '';

  return { valores, comentarios, calidad, esECG, observacionGeneral };
}

// --- Conexión con Claude (solo dentro de claude.ai) -------------------------

interface SampleFn {
  json(input: string, options: Record<string, unknown>): Promise<unknown>;
  limits(): Promise<{ images?: unknown }>;
}

interface ClaudeGlobal {
  use(nombre: string): Promise<unknown>;
}

export async function obtenerLectorClaude(): Promise<LectorIA | null> {
  const claude = (globalThis as { claude?: ClaudeGlobal }).claude;
  if (!claude || typeof claude.use !== 'function') return null;
  const sample = (await claude.use('sample').catch(() => null)) as SampleFn | null;
  if (!sample) return null;
  const limites = await sample.limits().catch(() => null);
  if (!limites?.images) return null;
  return {
    async leer(imagen, signal) {
      const respuesta = await sample.json(PROMPT_LECTURA, {
        images: [imagen],
        modelTier: 'complex',
        cache: false,
        signal,
      });
      return interpretarRespuestaIA(respuesta);
    },
  };
}

/** Mensaje para el usuario según el código de error de Claude. */
export function mensajeErrorIA(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'cancelled':
      return 'Lectura cancelada.';
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'images_unavailable':
      return 'La lectura automática no está habilitada para vos en esta página.';
    case 'rate_limited':
      return 'Se alcanzó el límite de uso de Claude. Probá más tarde.';
    case 'image_rejected':
      return 'Claude no pudo procesar esta imagen. Probá con otra foto o archivo.';
    case 'refused':
      return 'Claude no pudo leer esta imagen.';
    case 'invalid_json':
      return 'La respuesta de la IA no tuvo el formato esperado.';
    case 'session_expired':
      return 'Tu sesión de claude.ai expiró. Volvé a iniciar sesión.';
    default:
      return 'No se pudo completar la lectura automática.';
  }
}
