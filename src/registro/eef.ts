/**
 * Localización de la vía accesoria confirmada en el estudio electrofisiológico
 * (EEF) y su comparación con la región que predijo el algoritmo.
 *
 * La correspondencia entre cada sitio confirmado y las regiones de Arruda
 * (`compatibles`) es una propuesta de esta herramienta y DEBE revisarla el
 * equipo de electrofisiología (ver docs/LIMITACIONES.md).
 */
import type { CodigoAlgoritmo, CodigoRegion } from '../algoritmo/tipos';

export type CodigoEEF =
  | 'LAL' | 'LL' | 'LPL' | 'LP' | 'PSMA'
  | 'AS_PH' | 'MS' | 'PSTA' | 'CSOS' | 'PS_SUBEPI'
  | 'RA' | 'RAL' | 'RL' | 'RPL' | 'RP'
  | 'MULTIPLES' | 'NO_LOCALIZADA';

export type FuenteEEF = 'ablacion_exitosa' | 'mapeo_sin_ablacion';

export interface LocalizacionEEF {
  codigo: CodigoEEF;
  nombre: string;
  grupo: string;
  /** Regiones de Arruda que se consideran coincidentes con este sitio. */
  compatibles: CodigoRegion[];
}

const L = (codigo: CodigoEEF, nombre: string, grupo: string, compatibles: CodigoRegion[]): LocalizacionEEF => ({
  codigo, nombre, grupo, compatibles,
});

export const LOCALIZACIONES_EEF: LocalizacionEEF[] = [
  L('LAL', 'Anterolateral izquierda', 'Pared libre izquierda (anillo mitral)', ['LL_LAL']),
  L('LL', 'Lateral izquierda', 'Pared libre izquierda (anillo mitral)', ['LL_LAL']),
  L('LPL', 'Posterolateral izquierda', 'Pared libre izquierda (anillo mitral)', ['LP_LPL']),
  L('LP', 'Posterior izquierda', 'Pared libre izquierda (anillo mitral)', ['LP_LPL']),
  L('PSMA', 'Posteroseptal mitral (izquierda)', 'Septal', ['PSMA']),
  L('AS_PH', 'Anteroseptal / parahisiana', 'Septal', ['AS_RAPS']),
  L('MS', 'Medioseptal', 'Septal', ['MSTA']),
  L('PSTA', 'Posteroseptal tricuspídea (derecha)', 'Septal', ['PSTA_CSOS', 'PSTA']),
  L('CSOS', 'Región del ostium del seno coronario (endocárdica)', 'Septal', ['PSTA_CSOS']),
  L('PS_SUBEPI', 'Posteroseptal subepicárdica (seno coronario, vena cardíaca media o divertículo)', 'Septal', ['PS_SUBEPI']),
  L('RA', 'Anterior derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RA_RAL']),
  L('RAL', 'Anterolateral derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RA_RAL']),
  L('RL', 'Lateral derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RL']),
  L('RPL', 'Posterolateral derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RP_RPL']),
  L('RP', 'Posterior derecha', 'Pared libre derecha (anillo tricuspídeo)', ['RP_RPL']),
  L('MULTIPLES', 'Vías accesorias múltiples', 'Otras situaciones', []),
  L('NO_LOCALIZADA', 'No localizada / estudio no concluyente', 'Otras situaciones', []),
];

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
  if (!sitio || sitio.compatibles.length === 0) return 'no_evaluable';
  if (regionesPredichas.length === 0) return 'sin_prediccion';
  const aciertos = regionesPredichas.filter((r) => (sitio.compatibles as string[]).includes(r)).length;
  if (aciertos === 0) return 'discordante';
  return regionesPredichas.length > 1 ? 'parcial' : 'concordante';
}

export interface DatosEEF {
  localizacion: CodigoEEF;
  fuente: FuenteEEF | null;
  /** Concordancia del algoritmo principal del análisis. */
  concordancia: Concordancia;
  /** Concordancia de cada algoritmo calculado sobre el mismo ECG. */
  concordancias?: Partial<Record<CodigoAlgoritmo, Concordancia>>;
}

export function construirEEF(
  regionesPredichas: readonly string[],
  localizacion: CodigoEEF,
  fuente: FuenteEEF | null,
  predicciones?: Partial<Record<CodigoAlgoritmo, readonly string[]>>,
): DatosEEF {
  const datos: DatosEEF = { localizacion, fuente, concordancia: evaluarConcordancia(regionesPredichas, localizacion) };
  if (predicciones && Object.keys(predicciones).length > 0) {
    datos.concordancias = Object.fromEntries(
      Object.entries(predicciones).map(([alg, regs]) => [alg, evaluarConcordancia(regs ?? [], localizacion)]),
    ) as Partial<Record<CodigoAlgoritmo, Concordancia>>;
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
