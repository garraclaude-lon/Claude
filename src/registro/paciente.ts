/** Datos demográficos mínimos y anónimos del paciente. */

export type Sexo = 'femenino' | 'masculino' | 'no_consignado';

export interface DatosPaciente {
  sexo: Sexo;
  edadAnios: number;
  edadMeses: number;
}

export type GrupoEtario = 'neonato' | 'lactante' | 'preescolar' | 'escolar' | 'adolescente' | 'adulto';

export const NOMBRES_SEXO: Record<Sexo, string> = {
  femenino: 'Femenino',
  masculino: 'Masculino',
  no_consignado: 'No consignado',
};

export const NOMBRES_GRUPO: Record<GrupoEtario, string> = {
  neonato: 'Neonato (< 1 mes)',
  lactante: 'Lactante (1–11 meses)',
  preescolar: 'Preescolar (1–5 años)',
  escolar: 'Escolar (6–11 años)',
  adolescente: 'Adolescente (12–17 años)',
  adulto: 'Adulto (≥ 18 años)',
};

export const EDAD_MAX_ANIOS = 120;

export function edadTotalMeses(d: Pick<DatosPaciente, 'edadAnios' | 'edadMeses'>): number {
  return d.edadAnios * 12 + d.edadMeses;
}

/**
 * Grupo etario a partir de años y meses cumplidos. "Neonato" se aproxima
 * como 0 años y 0 meses (la definición habitual es 0–28 días).
 */
export function grupoEtario(d: Pick<DatosPaciente, 'edadAnios' | 'edadMeses'>): GrupoEtario {
  const { edadAnios: a, edadMeses: m } = d;
  if (a === 0) return m === 0 ? 'neonato' : 'lactante';
  if (a <= 5) return 'preescolar';
  if (a <= 11) return 'escolar';
  if (a <= 17) return 'adolescente';
  return 'adulto';
}

export interface ResultadoValidacion {
  datos: DatosPaciente | null;
  errores: Partial<Record<'sexo' | 'edadAnios' | 'edadMeses', string>>;
}

/** Valida lo que se escribió en el formulario (los campos llegan como texto). */
export function validarDatosPaciente(sexo: string | null, anios: string, meses: string): ResultadoValidacion {
  const errores: ResultadoValidacion['errores'] = {};
  if (sexo !== 'femenino' && sexo !== 'masculino' && sexo !== 'no_consignado') {
    errores.sexo = 'Elegí una opción.';
  }
  const entero = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN);
  const a = entero(anios);
  const m = meses.trim() === '' ? 0 : entero(meses);
  if (Number.isNaN(a)) errores.edadAnios = 'Escribí los años cumplidos (0 si es menor de 1 año).';
  else if (a > EDAD_MAX_ANIOS) errores.edadAnios = `Máximo ${EDAD_MAX_ANIOS} años.`;
  if (Number.isNaN(m) || m > 11) errores.edadMeses = 'Los meses van de 0 a 11.';

  if (Object.keys(errores).length > 0) return { datos: null, errores };
  return { datos: { sexo: sexo as Sexo, edadAnios: a, edadMeses: m }, errores };
}

export function describirPaciente(d: DatosPaciente): string {
  const edad = d.edadAnios === 0 ? `${d.edadMeses} ${d.edadMeses === 1 ? 'mes' : 'meses'}` : `${d.edadAnios} a ${d.edadMeses} m`;
  return `${NOMBRES_SEXO[d.sexo]} · ${edad} · ${NOMBRES_GRUPO[grupoEtario(d)]}`;
}
