import { describe, expect, it } from 'vitest';
import { ENTRADA_VACIA } from '../algoritmo/arruda';
import { aplicarSmartWPW } from '../algoritmo/smartwpw';
import type { EntradaECG, Polaridad } from '../algoritmo/tipos';

const e = (v: Partial<EntradaECG>): EntradaECG => ({ ...ENTRADA_VACIA, ...v });
/** Inferiores negativas según el patrón del diagrama: 0, 1 (III), 2 (III, aVF), 3 (II, III, aVF). */
const inferiores = (n: 0 | 1 | 2 | 3): Partial<EntradaECG> => ({
  deltaIII: n >= 1 ? 'negativa' : 'positiva',
  deltaAVF: n >= 2 ? 'negativa' : 'positiva',
  deltaII: n >= 3 ? 'negativa' : 'positiva',
});

describe('SMART-WPW — diagrama (figura 2)', () => {
  it.each([
    [0, 'A', [11, 12], 'RA_RAL'],
    [1, 'LA', [9, 10], 'RL'],
    [2, 'LP', [8], 'RP_RPL'],
    [3, 'P', [6, 7], 'RP_RPL'],
  ] as const)('tricuspídeo, pared libre (V3 negativa), %i inferiores negativas → %s', (n, sigla, horas, region) => {
    const r = aplicarSmartWPW(e({ deltaV1: 'negativa', qrsV3: 'negativa', ...inferiores(n) }));
    expect(r.sector).toMatchObject({ anillo: 'TV', sigla, horas: [...horas] });
    expect(r.regiones.map((x) => x.codigo)).toEqual([region]);
    expect(r.ruta).toHaveLength(3);
  });

  it.each([
    [0, 'AS', [1, 2]],
    [1, 'MS', [3]],
    [2, 'MSP', [4]],
    [3, 'PS', [5]],
  ] as const)('tricuspídeo septal (V3 positiva), %i inferiores negativas → %s', (n, sigla, horas) => {
    const r = aplicarSmartWPW(e({ deltaV1: 'negativa', qrsV3: 'positiva', ...inferiores(n) }));
    expect(r.sector).toMatchObject({ anillo: 'TV', sigla, horas: [...horas] });
  });

  it.each([
    [0, 'L', [1, 2, 3], 'LL_LAL'],
    [1, 'HPL', [4], 'LP_LPL'],
    [2, 'LPL', [5], 'LP_LPL'],
    [3, 'P&PS', [6, 7], 'PSMA'],
  ] as const)('mitral (V1 positiva), %i inferiores negativas → %s, sin preguntar V3', (n, sigla, horas, region) => {
    const r = aplicarSmartWPW(e({ deltaV1: 'positiva', ...inferiores(n) }));
    expect(r.sector).toMatchObject({ anillo: 'MV', sigla, horas: [...horas] });
    expect(r.regiones.map((x) => x.codigo)).toEqual([region]);
    expect(r.ruta).toHaveLength(2);
    expect(r.criteriosDeterminantes.map((c) => c.campo)).not.toContain('qrsV3');
  });
});

describe('SMART-WPW — datos faltantes e indeterminados', () => {
  it('pide V1, después V3 (solo derechas) y las inferiores (III, aVF, II)', () => {
    expect(aplicarSmartWPW(ENTRADA_VACIA).datosFaltantes).toEqual(['deltaV1']);
    expect(aplicarSmartWPW(e({ deltaV1: 'negativa' })).datosFaltantes).toEqual(['qrsV3']);
    expect(aplicarSmartWPW(e({ deltaV1: 'positiva' })).datosFaltantes).toEqual(['deltaIII']);
    expect(aplicarSmartWPW(e({ deltaV1: 'positiva', deltaIII: 'negativa' })).datosFaltantes).toEqual(['deltaAVF']);
  });

  it('V1 isoeléctrica se trata como mitral (texto del artículo)', () => {
    expect(aplicarSmartWPW(e({ deltaV1: 'isoelectrica', ...inferiores(0) })).sector?.anillo).toBe('MV');
  });

  it('isoeléctrica en una inferior no cuenta como negativa', () => {
    const r = aplicarSmartWPW(e({ deltaV1: 'positiva', deltaIII: 'isoelectrica', deltaAVF: 'positiva', deltaII: 'positiva' }));
    expect(r.sector?.sigla).toBe('L');
  });

  it.each([
    ['solo II', { deltaII: 'negativa', deltaIII: 'positiva', deltaAVF: 'positiva' }],
    ['II y III', { deltaII: 'negativa', deltaIII: 'negativa', deltaAVF: 'positiva' }],
    ['solo aVF', { deltaII: 'positiva', deltaIII: 'positiva', deltaAVF: 'negativa' }],
  ] as [string, Record<string, Polaridad>][])('combinación no prevista (%s) → indeterminado', (_n, inf) => {
    const r = aplicarSmartWPW(e({ deltaV1: 'positiva', ...inf }));
    expect(r.estado).toBe('indeterminado');
    expect(r.regiones).toEqual([]);
    expect(r.sector).toBeUndefined();
  });

  it('V3 isodifásica o no evaluable, o V1 no evaluable → indeterminado', () => {
    expect(aplicarSmartWPW(e({ deltaV1: 'negativa', qrsV3: 'isoelectrica' })).estado).toBe('indeterminado');
    expect(aplicarSmartWPW(e({ deltaV1: 'negativa', qrsV3: 'no_evaluable' })).estado).toBe('indeterminado');
    expect(aplicarSmartWPW(e({ deltaV1: 'no_evaluable' })).estado).toBe('indeterminado');
  });

  it('identifica el algoritmo y su referencia', () => {
    const r = aplicarSmartWPW(ENTRADA_VACIA);
    expect(r.algoritmo).toBe('smart_wpw');
    expect(r.referencia).toContain('Heart Rhythm');
  });
});
