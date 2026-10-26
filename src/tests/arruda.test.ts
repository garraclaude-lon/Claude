import { describe, expect, it } from 'vitest';
import { aplicarArruda, ENTRADA_VACIA, paso4 } from '../algoritmo/arruda';
import { REFERENCIA_ARRUDA, VERSION_ALGORITMO } from '../algoritmo/catalogo';
import type { EntradaECG } from '../algoritmo/tipos';

const e = (parcial: Partial<EntradaECG>): EntradaECG => ({ ...ENTRADA_VACIA, ...parcial });
const codigos = (entrada: EntradaECG) => aplicarArruda(entrada).regiones.map((r) => r.codigo);

// Entradas que "pasan" cada paso sin clasificar.
const NO_PASO1: Partial<EntradaECG> = { deltaI: 'positiva', rsV1: 'r_menor_igual_s' };
const NO_PASO2: Partial<EntradaECG> = { ...NO_PASO1, deltaII: 'positiva' };
const NO_PASO3: Partial<EntradaECG> = { ...NO_PASO2, deltaV1: 'positiva' };

describe('Paso 1 — pared libre izquierda', () => {
  it.each([
    ['I negativa', { deltaI: 'negativa' }],
    ['I isoeléctrica', { deltaI: 'isoelectrica' }],
    ['R > S en V1 con I positiva', { deltaI: 'positiva', rsV1: 'r_mayor_s' }],
  ] as const)('%s + aVF positiva → LL/LAL', (_n, p) => {
    const r = aplicarArruda(e({ ...p, deltaAVF: 'positiva' }));
    expect(r.estado).toBe('region_predicha');
    expect(r.regiones.map((x) => x.codigo)).toEqual(['LL_LAL']);
    expect(r.ruta).toHaveLength(1);
  });

  it.each(['negativa', 'isoelectrica'] as const)('aVF %s → LP/LPL', (avf) => {
    expect(codigos(e({ deltaI: 'negativa', deltaAVF: avf }))).toEqual(['LP_LPL']);
  });

  it('aVF sin dato → datos insuficientes (aVF)', () => {
    const r = aplicarArruda(e({ deltaI: 'negativa' }));
    expect(r.estado).toBe('datos_insuficientes');
    expect(r.datosFaltantes).toEqual(['deltaAVF']);
  });

  it('aVF no evaluable → indeterminado', () => {
    const r = aplicarArruda(e({ deltaI: 'negativa', deltaAVF: 'no_evaluable' }));
    expect(r.estado).toBe('indeterminado');
    expect(r.regiones).toEqual([]);
  });

  it('I negativa no exige R/S en V1', () => {
    expect(codigos(e({ deltaI: 'negativa', rsV1: null, deltaAVF: 'positiva' }))).toEqual(['LL_LAL']);
  });

  it('R > S en V1 no exige la delta en I', () => {
    expect(codigos(e({ deltaI: null, rsV1: 'r_mayor_s', deltaAVF: 'positiva' }))).toEqual(['LL_LAL']);
  });

  it('formulario vacío → pide I y R/S en V1', () => {
    const r = aplicarArruda(ENTRADA_VACIA);
    expect(r.estado).toBe('datos_insuficientes');
    expect(r.datosFaltantes).toEqual(['deltaI', 'rsV1']);
  });

  it('I positiva sin R/S en V1 → pide R/S en V1', () => {
    const r = aplicarArruda(e({ deltaI: 'positiva' }));
    expect(r.estado).toBe('datos_insuficientes');
    expect(r.datosFaltantes).toEqual(['rsV1']);
  });

  it('R ≤ S en V1 sin delta en I → pide I', () => {
    const r = aplicarArruda(e({ rsV1: 'r_menor_igual_s' }));
    expect(r.datosFaltantes).toEqual(['deltaI']);
  });

  it.each([
    ['I no evaluable, R ≤ S', { deltaI: 'no_evaluable', rsV1: 'r_menor_igual_s' }],
    ['I positiva, R/S V1 no evaluable', { deltaI: 'positiva', rsV1: 'no_evaluable' }],
    ['ambos no evaluables', { deltaI: 'no_evaluable', rsV1: 'no_evaluable' }],
  ] as const)('%s → indeterminado (no se descarta pared izquierda)', (_n, p) => {
    const r = aplicarArruda(e({ ...p, deltaII: 'negativa', deltaV1: 'negativa', deltaAVF: 'negativa' }));
    expect(r.estado).toBe('indeterminado');
    expect(r.ruta).toHaveLength(1);
  });
});

describe('Prioridad del paso 1 sobre los pasos siguientes', () => {
  it('I negativa gana aunque II, V1 y aVR también cumplan sus condiciones', () => {
    const r = aplicarArruda(
      e({ deltaI: 'negativa', deltaII: 'negativa', deltaV1: 'negativa', deltaAVR: 'positiva', deltaAVF: 'negativa', rsIII: 'r_mayor_s' }),
    );
    expect(r.regiones.map((x) => x.codigo)).toEqual(['LP_LPL']);
    expect(r.ruta.map((p) => p.paso)).toEqual([1]);
  });

  it('R > S en V1 gana sobre II negativa', () => {
    expect(codigos(e({ deltaI: 'positiva', rsV1: 'r_mayor_s', deltaII: 'negativa', deltaAVF: 'positiva' }))).toEqual(['LL_LAL']);
  });

  it('paso 2 gana sobre pasos 3 y 4', () => {
    const r = aplicarArruda(e({ ...NO_PASO1, deltaII: 'negativa', deltaV1: 'negativa', deltaAVF: 'negativa', deltaAVR: 'positiva' }));
    expect(r.regiones.map((x) => x.codigo)).toEqual(['PS_SUBEPI']);
    expect(r.ruta.map((p) => p.paso)).toEqual([1, 2]);
  });
});

describe('Paso 2 — posteroseptal subepicárdica', () => {
  it('II negativa → PS subepicárdica', () => {
    expect(codigos(e({ ...NO_PASO1, deltaII: 'negativa' }))).toEqual(['PS_SUBEPI']);
  });

  it.each(['positiva', 'isoelectrica'] as const)('II %s → continúa al paso 3', (ii) => {
    const r = aplicarArruda(e({ ...NO_PASO1, deltaII: ii }));
    expect(r.ruta[1].desenlace).toBe('continua');
    expect(r.ruta[2].paso).toBe(3);
  });

  it('II sin dato → datos insuficientes', () => {
    expect(aplicarArruda(e(NO_PASO1)).datosFaltantes).toEqual(['deltaII']);
  });

  it('II no evaluable → indeterminado', () => {
    expect(aplicarArruda(e({ ...NO_PASO1, deltaII: 'no_evaluable' })).estado).toBe('indeterminado');
  });
});

describe('Paso 3 — vías septales', () => {
  it.each(['negativa', 'isoelectrica'] as const)('V1 %s + aVF negativa → PSTA/CSOs', (v1) => {
    expect(codigos(e({ ...NO_PASO2, deltaV1: v1, deltaAVF: 'negativa' }))).toEqual(['PSTA_CSOS']);
  });

  it('aVF isoeléctrica → muestra PSTA y PSMA', () => {
    const r = aplicarArruda(e({ ...NO_PASO2, deltaV1: 'negativa', deltaAVF: 'isoelectrica' }));
    expect(r.estado).toBe('region_predicha');
    expect(r.regiones.map((x) => x.codigo)).toEqual(['PSTA', 'PSMA']);
  });

  it('aVF positiva + R > S en III → AS/RAPS', () => {
    expect(codigos(e({ ...NO_PASO2, deltaV1: 'negativa', deltaAVF: 'positiva', rsIII: 'r_mayor_s' }))).toEqual(['AS_RAPS']);
  });

  it('aVF positiva + R < S en III → MSTA', () => {
    expect(codigos(e({ ...NO_PASO2, deltaV1: 'negativa', deltaAVF: 'positiva', rsIII: 'r_menor_s' }))).toEqual(['MSTA']);
  });

  it.each(['iguales', 'no_evaluable'] as const)('aVF positiva + R/S en III %s → indeterminado', (iii) => {
    const r = aplicarArruda(e({ ...NO_PASO2, deltaV1: 'negativa', deltaAVF: 'positiva', rsIII: iii }));
    expect(r.estado).toBe('indeterminado');
    expect(r.regiones).toEqual([]);
  });

  it('aVF positiva sin R/S en III → pide R/S en III', () => {
    const r = aplicarArruda(e({ ...NO_PASO2, deltaV1: 'negativa', deltaAVF: 'positiva' }));
    expect(r.estado).toBe('datos_insuficientes');
    expect(r.datosFaltantes).toEqual(['rsIII']);
  });

  it('R/S en III no se pide si aVF no es positiva', () => {
    const r = aplicarArruda(e({ ...NO_PASO2, deltaV1: 'negativa', deltaAVF: 'negativa', rsIII: null }));
    expect(r.estado).toBe('region_predicha');
  });

  it('V1 septal sin aVF → pide aVF', () => {
    expect(aplicarArruda(e({ ...NO_PASO2, deltaV1: 'negativa' })).datosFaltantes).toEqual(['deltaAVF']);
  });

  it('V1 septal con aVF no evaluable → indeterminado', () => {
    expect(aplicarArruda(e({ ...NO_PASO2, deltaV1: 'negativa', deltaAVF: 'no_evaluable' })).estado).toBe('indeterminado');
  });

  it('V1 sin dato → pide V1', () => {
    expect(aplicarArruda(e(NO_PASO2)).datosFaltantes).toEqual(['deltaV1']);
  });

  it('V1 no evaluable → indeterminado', () => {
    expect(aplicarArruda(e({ ...NO_PASO2, deltaV1: 'no_evaluable' })).estado).toBe('indeterminado');
  });

  it('V1 positiva → continúa al paso 4', () => {
    const r = aplicarArruda(e({ ...NO_PASO3 }));
    expect(r.ruta[2].desenlace).toBe('continua');
    expect(r.ruta[3].paso).toBe(4);
  });
});

describe('Paso 4 — pared libre derecha', () => {
  it('aVR positiva → RA/RAL', () => {
    expect(codigos(e({ ...NO_PASO3, deltaAVR: 'positiva' }))).toEqual(['RA_RAL']);
  });

  it.each(['negativa', 'isoelectrica'] as const)('aVR %s + II positiva → RL', (avr) => {
    expect(codigos(e({ ...NO_PASO3, deltaAVR: avr, deltaII: 'positiva' }))).toEqual(['RL']);
  });

  it.each(['negativa', 'isoelectrica'] as const)('aVR %s + II isoeléctrica → RP/RPL', (avr) => {
    expect(codigos(e({ ...NO_PASO3, deltaAVR: avr, deltaII: 'isoelectrica' }))).toEqual(['RP_RPL']);
  });

  it('aVR sin dato → pide aVR', () => {
    expect(aplicarArruda(e(NO_PASO3)).datosFaltantes).toEqual(['deltaAVR']);
  });

  it('aVR no evaluable → indeterminado', () => {
    expect(aplicarArruda(e({ ...NO_PASO3, deltaAVR: 'no_evaluable' })).estado).toBe('indeterminado');
  });

  // Con II negativa el recorrido completo termina en el paso 2, así que esta
  // rama del paso 4 solo es alcanzable evaluando el paso de forma aislada.
  it('II negativa en el paso 4 (evaluado aisladamente) → no clasificable', () => {
    const s = paso4(e({ deltaAVR: 'negativa', deltaII: 'negativa' }));
    expect(s.fin?.estado).toBe('no_clasificable');
    expect(s.fin?.regiones).toEqual([]);
  });

  it('II no evaluable en el paso 4 (aislado) → indeterminado', () => {
    expect(paso4(e({ deltaAVR: 'isoelectrica', deltaII: 'no_evaluable' })).fin?.estado).toBe('indeterminado');
  });

  it('II sin dato en el paso 4 (aislado) → pide II', () => {
    expect(paso4(e({ deltaAVR: 'negativa' })).fin?.datosFaltantes).toEqual(['deltaII']);
  });

  it('en el recorrido completo, II negativa nunca llega al paso 4', () => {
    const r = aplicarArruda(e({ ...NO_PASO1, deltaII: 'negativa', deltaV1: 'positiva', deltaAVR: 'negativa' }));
    expect(r.ruta.map((p) => p.paso)).toEqual([1, 2]);
  });
});

describe('Metadatos del resultado', () => {
  it('incluye referencia y versión', () => {
    const r = aplicarArruda(e({ deltaI: 'negativa', deltaAVF: 'positiva' }));
    expect(r.referencia).toBe(REFERENCIA_ARRUDA);
    expect(r.versionAlgoritmo).toBe(VERSION_ALGORITMO);
  });
});

// ---------------------------------------------------------------------------
// Prueba exhaustiva: todas las combinaciones posibles de entrada.
// ---------------------------------------------------------------------------
const POL = [null, 'positiva', 'negativa', 'isoelectrica', 'no_evaluable'] as const;
const RSV1 = [null, 'r_mayor_s', 'r_menor_igual_s', 'no_evaluable'] as const;
const RSIII = [null, 'r_mayor_s', 'r_menor_s', 'iguales', 'no_evaluable'] as const;

function* todasLasEntradas(): Generator<EntradaECG> {
  for (const deltaI of POL)
    for (const deltaII of POL)
      for (const deltaAVF of POL)
        for (const deltaV1 of POL)
          for (const deltaAVR of POL)
            for (const rsV1 of RSV1)
              for (const rsIII of RSIII) yield { deltaI, deltaII, deltaAVF, deltaV1, deltaAVR, rsV1, rsIII };
}

describe('Consistencia en todas las combinaciones de entrada', () => {
  it('resultado, ruta y criterios son coherentes entre sí', () => {
    let n = 0;
    for (const entrada of todasLasEntradas()) {
      n++;
      const r = aplicarArruda(entrada);
      const ultimo = r.ruta[r.ruta.length - 1];

      // Pasos consecutivos desde 1; todos salvo el último continúan.
      expect(r.ruta.map((p) => p.paso)).toEqual(r.ruta.map((_, i) => i + 1));
      r.ruta.slice(0, -1).forEach((p) => expect(p.desenlace).toBe('continua'));

      // El último paso coincide con el estado.
      expect(ultimo.desenlace).toBe(r.estado === 'region_predicha' ? 'clasifica' : 'detiene');
      expect(r.regiones.length > 0).toBe(r.estado === 'region_predicha');
      expect(r.datosFaltantes.length > 0).toBe(r.estado === 'datos_insuficientes');

      // La explicación del último paso nombra cada región predicha.
      for (const reg of r.regiones) expect(ultimo.decision).toContain(reg.abreviatura);

      // Los datos faltantes realmente están vacíos (nunca se asumió un valor).
      for (const c of r.datosFaltantes) expect(entrada[c]).toBeNull();

      // Los criterios muestran exactamente lo ingresado.
      for (const c of r.criteriosDeterminantes) expect(c.valor).toBe(entrada[c.campo] ?? 'sin_dato');

      // Una predicción solo se apoya en datos cargados y evaluables.
      if (r.estado === 'region_predicha') {
        for (const c of r.criteriosDeterminantes) {
          expect(c.valor).not.toBe('sin_dato');
          expect(c.valor).not.toBe('no_evaluable');
        }
      }

      // El resultado depende solo de los criterios mostrados: si se borran
      // los demás campos, el resultado no cambia.
      const reducida = { ...ENTRADA_VACIA };
      for (const c of r.criteriosDeterminantes) (reducida as Record<string, unknown>)[c.campo] = entrada[c.campo];
      const r2 = aplicarArruda(reducida);
      expect(r2.estado).toBe(r.estado);
      expect(r2.regiones).toEqual(r.regiones);
    }
    expect(n).toBe(5 ** 5 * 4 * 5);
  });

  it('es determinista', () => {
    const entrada = e({ ...NO_PASO2, deltaV1: 'negativa', deltaAVF: 'positiva', rsIII: 'r_menor_s' });
    expect(aplicarArruda(entrada)).toEqual(aplicarArruda(entrada));
  });
});
