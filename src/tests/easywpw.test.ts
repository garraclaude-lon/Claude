import { describe, expect, it } from 'vitest';
import { ENTRADA_VACIA } from '../algoritmo/arruda';
import { aplicarEasyWPW } from '../algoritmo/easywpw';
import type { DeltaMasPositiva, EntradaECG, Polaridad, TransicionQRS } from '../algoritmo/tipos';

const e = (v: Partial<EntradaECG>): EntradaECG => ({ ...ENTRADA_VACIA, ...v });
const codigos = (x: EntradaECG) => aplicarEasyWPW(x).regiones.map((r) => r.codigo);

describe('EASY-WPW — vías izquierdas (V1 positiva)', () => {
  it.each([
    ['avl', 'PSMA'],
    ['ii', 'LP_LPL'],
    ['avr', 'LP_LPL'],
    ['iii', 'LL_LAL'],
  ] as [DeltaMasPositiva, string][])('delta más positiva en %s → %s (sin pedir la transición)', (d, region) => {
    const r = aplicarEasyWPW(e({ qrsV1: 'positiva', deltaMasPositiva: d }));
    expect(r.estado).toBe('region_predicha');
    expect(r.regiones.map((x) => x.codigo)).toEqual([region]);
    expect(r.ruta).toHaveLength(2);
    expect(r.criteriosDeterminantes.map((c) => c.campo)).toEqual(['qrsV1', 'deltaMasPositiva']);
  });
});

describe('EASY-WPW — vías derechas (V1 negativa o isoeléctrica)', () => {
  it.each([
    ['hasta_v3', 'ii', 'AS_RAPS'],
    ['hasta_v3', 'iii', 'AS_RAPS'],
    ['hasta_v3', 'avl', 'PSTA'],
    ['hasta_v3', 'avr', 'PSTA'],
    ['v4_o_despues', 'ii', 'RA_RAL'],
    ['v4_o_despues', 'iii', 'AS_RAPS'],
    ['v4_o_despues', 'avr', 'PSTA'],
    ['v4_o_despues', 'avl', 'RP_RPL'],
  ] as [TransicionQRS, DeltaMasPositiva, string][])('transición %s, delta más positiva en %s → %s', (t, d, region) => {
    for (const v1 of ['negativa', 'isoelectrica'] as Polaridad[]) {
      const r = aplicarEasyWPW(e({ qrsV1: v1, transicionQRS: t, deltaMasPositiva: d }));
      expect(r.regiones.map((x) => x.codigo)).toEqual([region]);
      expect(r.ruta).toHaveLength(3);
    }
  });
});

describe('EASY-WPW — datos faltantes e indeterminados', () => {
  it('pide primero V1, después la transición (solo en derechas) y la delta más positiva', () => {
    expect(aplicarEasyWPW(ENTRADA_VACIA).datosFaltantes).toEqual(['qrsV1']);
    expect(aplicarEasyWPW(e({ qrsV1: 'negativa' })).datosFaltantes).toEqual(['transicionQRS']);
    expect(aplicarEasyWPW(e({ qrsV1: 'negativa', transicionQRS: 'hasta_v3' })).datosFaltantes).toEqual(['deltaMasPositiva']);
    expect(aplicarEasyWPW(e({ qrsV1: 'positiva' })).datosFaltantes).toEqual(['deltaMasPositiva']);
  });

  it('no evaluable o empate → indeterminado, sin inventar una región', () => {
    expect(aplicarEasyWPW(e({ qrsV1: 'no_evaluable' })).estado).toBe('indeterminado');
    expect(aplicarEasyWPW(e({ qrsV1: 'negativa', transicionQRS: 'no_evaluable' })).estado).toBe('indeterminado');
    const empate = aplicarEasyWPW(e({ qrsV1: 'positiva', deltaMasPositiva: 'empate' }));
    expect(empate.estado).toBe('indeterminado');
    expect(empate.regiones).toEqual([]);
  });

  it('ignora los datos de Arruda', () => {
    expect(codigos(e({ deltaI: 'negativa', rsV1: 'r_mayor_s', qrsV1: 'negativa', transicionQRS: 'v4_o_despues', deltaMasPositiva: 'ii' }))).toEqual(['RA_RAL']);
  });

  it('identifica el algoritmo y su referencia', () => {
    const r = aplicarEasyWPW(ENTRADA_VACIA);
    expect(r.algoritmo).toBe('easy_wpw');
    expect(r.referencia).toContain('Europace');
    expect(r.versionAlgoritmo).toMatch(/^easy-wpw/);
  });
});
