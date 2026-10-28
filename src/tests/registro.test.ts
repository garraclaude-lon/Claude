import { describe, expect, it } from 'vitest';
import { aplicarArruda, ENTRADA_VACIA } from '../algoritmo/arruda';
import type { EntradaECG } from '../algoritmo/tipos';
import { describirPaciente, grupoEtario, validarDatosPaciente } from '../registro/paciente';
import { construirRegistro, obtenerRepositorioClaude, resumir } from '../registro/registro';

describe('grupoEtario', () => {
  it.each([
    [0, 0, 'neonato'],
    [0, 1, 'lactante'],
    [0, 11, 'lactante'],
    [1, 0, 'preescolar'],
    [5, 11, 'preescolar'],
    [6, 0, 'escolar'],
    [11, 11, 'escolar'],
    [12, 0, 'adolescente'],
    [17, 11, 'adolescente'],
    [18, 0, 'adulto'],
  ] as const)('%i años %i meses → %s', (a, m, g) => {
    expect(grupoEtario({ edadAnios: a, edadMeses: m })).toBe(g);
  });
});

describe('validarDatosPaciente', () => {
  it('acepta datos válidos; meses vacío cuenta como 0', () => {
    expect(validarDatosPaciente('femenino', '7', '').datos).toEqual({ sexo: 'femenino', edadAnios: 7, edadMeses: 0 });
  });

  it.each([
    [null, '5', '0', 'sexo'],
    ['otro', '5', '0', 'sexo'],
    ['masculino', '', '0', 'edadAnios'],
    ['masculino', '-1', '0', 'edadAnios'],
    ['masculino', '2.5', '0', 'edadAnios'],
    ['masculino', '121', '0', 'edadAnios'],
    ['masculino', '2', '12', 'edadMeses'],
  ])('rechaza sexo=%s años=%s meses=%s (%s)', (sexo, a, m, campo) => {
    const r = validarDatosPaciente(sexo, a, m);
    expect(r.datos).toBeNull();
    expect(r.errores).toHaveProperty(campo);
  });

  it('describe al paciente', () => {
    expect(describirPaciente({ sexo: 'no_consignado', edadAnios: 0, edadMeses: 1 })).toBe('No consignado · 1 mes · Lactante (1–11 meses)');
  });
});

const e = (p: Partial<EntradaECG>): EntradaECG => ({ ...ENTRADA_VACIA, ...p });

describe('construirRegistro', () => {
  const paciente = { sexo: 'masculino' as const, edadAnios: 2, edadMeses: 3 };

  it('guarda paciente, criterios y resultado, sin datos de la imagen', () => {
    const criterios = e({ deltaI: 'negativa', deltaAVF: 'positiva' });
    const r = construirRegistro({ modo: 'guiado', paciente, criterios, resultado: aplicarArruda(criterios) });
    expect(r.paciente).toEqual({ sexo: 'masculino', edadAnios: 2, edadMeses: 3, edadTotalMeses: 27, grupoEtario: 'preescolar' });
    expect(r.resultado).toEqual({ estado: 'region_predicha', regiones: ['LL_LAL'], datosFaltantes: [] });
    expect(r.ia).toBeNull();
    expect(JSON.stringify(r)).not.toMatch(/blob:|data:image|nombre/);
  });

  it('cuenta la concordancia con la IA solo sobre los criterios revisados', () => {
    const criterios = e({ deltaI: 'isoelectrica', deltaAVF: 'negativa' });
    const propuesta = {
      valores: e({ deltaI: 'negativa', deltaAVF: 'negativa', deltaV1: 'positiva' }),
      comentarios: {}, calidad: 'buena' as const, esECG: true, observacionGeneral: 'texto libre',
    };
    const r = construirRegistro({
      modo: 'imagen', paciente, criterios, resultado: aplicarArruda(criterios), propuesta, revisados: ['deltaI', 'deltaAVF'],
    });
    expect(r.ia).toMatchObject({ criteriosRevisados: 2, coincidencias: 1, calidad: 'buena' });
    // El texto libre de la IA no se guarda.
    expect(JSON.stringify(r)).not.toContain('texto libre');
  });
});

describe('resumir', () => {
  it('cuenta por sexo, grupo y región, e ignora documentos inválidos', () => {
    const p = { sexo: 'femenino' as const, edadAnios: 0, edadMeses: 5 };
    const a = construirRegistro({ modo: 'guiado', paciente: p, criterios: ENTRADA_VACIA, resultado: aplicarArruda(e({ deltaI: 'negativa', deltaAVF: 'positiva' })) });
    const septal = e({ deltaI: 'positiva', rsV1: 'r_menor_igual_s', deltaII: 'positiva', deltaV1: 'negativa', deltaAVF: 'isoelectrica' });
    const b = construirRegistro({ modo: 'guiado', paciente: { ...p, sexo: 'masculino', edadAnios: 14 }, criterios: septal, resultado: aplicarArruda(septal) });
    const c = construirRegistro({ modo: 'guiado', paciente: p, criterios: ENTRADA_VACIA, resultado: aplicarArruda(ENTRADA_VACIA) });
    const r = resumir([a, b, c, null, { basura: 1 }, 'x']);
    expect(r.total).toBe(3);
    expect(r.porSexo).toEqual({ femenino: 2, masculino: 1 });
    expect(r.porGrupo).toEqual({ lactante: 2, adolescente: 1 });
    expect(r.porRegion).toEqual({ LL_LAL: 1, 'PSTA o PSMA': 1 });
    expect(r.porEstado).toEqual({ region_predicha: 2, datos_insuficientes: 1 });
  });

  it('fuera de claude.ai no hay repositorio', async () => {
    expect(await obtenerRepositorioClaude()).toBeNull();
  });
});
