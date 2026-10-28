/**
 * Registro anónimo de cada análisis, para estadísticas futuras.
 *
 * Se guarda en la base de datos privada de la página publicada en
 * claude.ai (capacidad `db`). Nunca se guarda la imagen del ECG.
 * Fuera de claude.ai no hay repositorio y la app lo indica.
 */
import { VERSION_ALGORITMO } from '../algoritmo/catalogo';
import type { CampoECG, EntradaECG, ResultadoArruda } from '../algoritmo/tipos';
import type { PropuestaIA } from '../ia/lectorIA';
import { type Concordancia, type DatosEEF } from './eef';
import { edadTotalMeses, grupoEtario, type DatosPaciente, type GrupoEtario, type Sexo } from './paciente';

export const VERSION_APP = '0.5.0';
export const ESQUEMA_REGISTRO = 2;
export const COLECCION = 'analisis';

export type ModoAnalisis = 'imagen' | 'guiado' | 'formulario';

export interface RegistroAnalisis {
  esquema: number;
  /** Código corto (WPW-XXXXXX) para cargar después el resultado del EEF. */
  codigo: string;
  versionApp: string;
  versionAlgoritmo: string;
  modo: ModoAnalisis;
  paciente: {
    sexo: Sexo;
    edadAnios: number;
    edadMeses: number;
    edadTotalMeses: number;
    grupoEtario: GrupoEtario;
  };
  criterios: EntradaECG;
  resultado: {
    estado: ResultadoArruda['estado'];
    regiones: string[];
    datosFaltantes: CampoECG[];
  };
  ia: null | {
    valores: EntradaECG;
    calidad: PropuestaIA['calidad'];
    esECG: boolean | null;
    criteriosRevisados: number;
    coincidencias: number;
  };
  /** Localización confirmada en el estudio electrofisiológico; null = pendiente. */
  eef: DatosEEF | null;
}

/** Lo que se lee de la base: el registro más los datos que agrega el guardado. */
export type RegistroGuardado = RegistroAnalisis & { creadoEn?: string; actualizadoEn?: string };

export interface DatosParaRegistro {
  codigo: string;
  eef?: DatosEEF | null;
  modo: ModoAnalisis;
  paciente: DatosPaciente;
  criterios: EntradaECG;
  resultado: ResultadoArruda;
  propuesta?: PropuestaIA | null;
  /** Criterios que el profesional revisó (para la concordancia con la IA). */
  revisados?: CampoECG[];
}

export function construirRegistro(d: DatosParaRegistro): RegistroAnalisis {
  const revisados = d.revisados ?? [];
  return {
    esquema: ESQUEMA_REGISTRO,
    codigo: d.codigo,
    versionApp: VERSION_APP,
    versionAlgoritmo: VERSION_ALGORITMO,
    modo: d.modo,
    paciente: {
      sexo: d.paciente.sexo,
      edadAnios: d.paciente.edadAnios,
      edadMeses: d.paciente.edadMeses,
      edadTotalMeses: edadTotalMeses(d.paciente),
      grupoEtario: grupoEtario(d.paciente),
    },
    criterios: { ...d.criterios },
    resultado: {
      estado: d.resultado.estado,
      regiones: d.resultado.regiones.map((r) => r.codigo),
      datosFaltantes: [...d.resultado.datosFaltantes],
    },
    ia: d.propuesta
      ? {
          valores: { ...d.propuesta.valores },
          calidad: d.propuesta.calidad,
          esECG: d.propuesta.esECG,
          criteriosRevisados: revisados.length,
          coincidencias: revisados.filter(
            (c) => d.propuesta!.valores[c] !== null && d.propuesta!.valores[c] === d.criterios[c],
          ).length,
        }
      : null,
    eef: d.eef ?? null,
  };
}

// --- Resumen para la pantalla de inicio -----------------------------------

export interface Resumen {
  total: number;
  porSexo: Record<string, number>;
  porGrupo: Record<string, number>;
  porRegion: Record<string, number>;
  porEstado: Record<string, number>;
  /** Análisis con localización confirmada por EEF. */
  conEEF: number;
  porConcordancia: Partial<Record<Concordancia, number>>;
  /** Análisis guardados sin resultado de EEF, más recientes primero. */
  pendientesEEF: RegistroGuardado[];
}

/** Cuenta registros. Ignora documentos con forma inesperada. */
export function resumir(registros: unknown[]): Resumen {
  const r: Resumen = { total: 0, porSexo: {}, porGrupo: {}, porRegion: {}, porEstado: {}, conEEF: 0, porConcordancia: {}, pendientesEEF: [] };
  const sumar = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
  for (const x of registros) {
    const reg = x as Partial<RegistroAnalisis>;
    if (!reg || typeof reg !== 'object' || !reg.paciente || !reg.resultado) continue;
    r.total++;
    sumar(r.porSexo, String(reg.paciente.sexo));
    sumar(r.porGrupo, String(reg.paciente.grupoEtario));
    sumar(r.porEstado, String(reg.resultado.estado));
    const regiones = Array.isArray(reg.resultado.regiones) ? reg.resultado.regiones : [];
    // Con dos regiones posibles (PSTA o PSMA) se cuenta la combinación.
    if (regiones.length > 0) sumar(r.porRegion, regiones.join(' o '));
    if (reg.eef && typeof reg.eef === 'object' && reg.eef.concordancia) {
      r.conEEF++;
      sumar(r.porConcordancia, String(reg.eef.concordancia));
    } else if (typeof reg.codigo === 'string') {
      r.pendientesEEF.push(reg as RegistroGuardado);
    }
  }
  r.pendientesEEF.sort((a, b) => String(b.creadoEn ?? '').localeCompare(String(a.creadoEn ?? '')));
  return r;
}

/**
 * Porcentaje de coincidencia entre la predicción y el EEF, sobre los casos
 * en que hubo predicción y sitio confirmado comparable. "Parcial" (dos
 * opciones) se informa aparte y no se cuenta como acierto.
 */
export function tasaConcordancia(r: Resumen): { aciertos: number; parciales: number; comparables: number } {
  const c = r.porConcordancia;
  const aciertos = c.concordante ?? 0;
  const parciales = c.parcial ?? 0;
  return { aciertos, parciales, comparables: aciertos + parciales + (c.discordante ?? 0) };
}

// --- Conexión con la base de datos de claude.ai ----------------------------

export interface Repositorio {
  /** Guarda o actualiza un análisis; su id es el código del registro. */
  guardar(registro: RegistroAnalisis): Promise<void>;
  /** Lee un análisis por su código, o null si no existe. */
  obtener(codigo: string): Promise<RegistroGuardado | null>;
  /** Carga (o borra, con null) el resultado del EEF de un análisis existente. */
  actualizarEEF(codigo: string, eef: DatosEEF | null): Promise<void>;
  /** Avisa cada vez que cambian los registros. Devuelve la función para dejar de escuchar. */
  escuchar(alCambiar: (registros: unknown[]) => void): () => void;
}

interface DocRef {
  id: string;
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
  update(data: Record<string, unknown>): Promise<void>;
}
interface DbNs {
  collection(path: string): {
    doc(id?: string): DocRef;
    onSnapshot(
      next: (snap: { docs: { data(): Record<string, unknown> | undefined }[] }) => void,
      error?: (e: unknown) => void,
    ): () => void;
  };
}
interface UserNs {
  id(): Promise<string | null>;
}
interface ClaudeGlobal {
  use(nombre: string): Promise<unknown>;
}

export async function obtenerRepositorioClaude(): Promise<Repositorio | null> {
  const claude = (globalThis as { claude?: ClaudeGlobal }).claude;
  if (!claude || typeof claude.use !== 'function') return null;
  const db = (await claude.use('db').catch(() => null)) as DbNs | null;
  if (!db) return null;
  const user = (await claude.use('user').catch(() => null)) as UserNs | null;
  const coleccion = db.collection(COLECCION);

  return {
    async guardar(registro) {
      const ref = coleccion.doc(registro.codigo);
      const ahora = new Date().toISOString();
      const previo = await ref.get();
      const datos = previo.exists ? previo.data() : undefined;
      const creadoEn = typeof datos?.creadoEn === 'string' ? datos.creadoEn : ahora;
      const creadoPor =
        typeof datos?.creadoPor === 'string' ? datos.creadoPor : ((await user?.id().catch(() => null)) ?? null);
      await ref.set({ ...registro, creadoEn, actualizadoEn: ahora, creadoPor });
    },
    async obtener(codigo) {
      const snap = await coleccion.doc(codigo).get();
      return snap.exists ? ((snap.data() ?? null) as RegistroGuardado | null) : null;
    },
    async actualizarEEF(codigo, eef) {
      await coleccion.doc(codigo).update({ eef, actualizadoEn: new Date().toISOString() });
    },
    escuchar(alCambiar) {
      return coleccion.onSnapshot(
        (snap) => alCambiar(snap.docs.map((d) => d.data())),
        () => {},
      );
    },
  };
}

/** Mensaje para el usuario según el error de la base de datos. */
export function mensajeErrorRegistro(error: unknown): string {
  switch ((error as { code?: string })?.code) {
    case 'invalid_argument':
      return 'No tenés permiso para guardar en este registro. Pedile a quien te compartió la página acceso de "Colaborador".';
    case 'quota_exceeded':
      return 'El registro está lleno. Hay que exportar y depurar registros antes de seguir.';
    case 'resource_exhausted':
      return 'Demasiadas operaciones seguidas. Esperá unos segundos y volvé a intentar.';
    default:
      return 'No se pudo guardar. Revisá tu conexión y volvé a intentar.';
  }
}
