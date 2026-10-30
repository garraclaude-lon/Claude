import { describe, expect, it } from 'vitest';
import { aplicarArruda, ENTRADA_VACIA } from '../algoritmo/arruda';
import { aplicarEasyWPW } from '../algoritmo/easywpw';
import { aplicarSmartWPW } from '../algoritmo/smartwpw';
import type { EntradaECG } from '../algoritmo/tipos';
import { describirPaciente, grupoEtario, validarDatosPaciente } from '../registro/paciente';
import { construirEEF, distanciaHoras, evaluarConcordancia, generarCodigo, LEGADO_A_HORA, LOCALIZACIONES_EEF, normalizarCodigo, POR_CODIGO_EEF } from '../registro/eef';
import { construirRegistro, obtenerRepositorioClaude, prediccionesDe, prediccionesDeResultados, resumir, tasaConcordancia } from '../registro/registro';
import { REGIONES } from '../algoritmo/catalogo';

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
    const r = construirRegistro({ codigo: 'WPW-AAAAAA', modo: 'guiado', paciente, criterios, resultado: aplicarArruda(criterios) });
    expect(r.paciente).toEqual({ sexo: 'masculino', edadAnios: 2, edadMeses: 3, edadTotalMeses: 27, grupoEtario: 'preescolar' });
    expect(r.resultado).toEqual({ estado: 'region_predicha', regiones: ['LL_LAL'], datosFaltantes: [] });
    expect(r.ia).toBeNull();
    expect(r.eef).toBeNull();
    expect(r.codigo).toBe('WPW-AAAAAA');
    expect(JSON.stringify(r)).not.toMatch(/blob:|data:image|nombre/);
  });

  it('cuenta la concordancia con la IA solo sobre los criterios revisados', () => {
    const criterios = e({ deltaI: 'isoelectrica', deltaAVF: 'negativa' });
    const propuesta = {
      valores: e({ deltaI: 'negativa', deltaAVF: 'negativa', deltaV1: 'positiva' }),
      comentarios: {}, calidad: 'buena' as const, esECG: true, observacionGeneral: 'texto libre',
    };
    const r = construirRegistro({
      codigo: 'WPW-AAAAAA', modo: 'imagen', paciente, criterios, resultado: aplicarArruda(criterios), propuesta, revisados: ['deltaI', 'deltaAVF'],
    });
    expect(r.ia).toMatchObject({ criteriosRevisados: 2, coincidencias: 1, calidad: 'buena' });
    // El texto libre de la IA no se guarda.
    expect(JSON.stringify(r)).not.toContain('texto libre');
  });
});

describe('resumir', () => {
  it('cuenta por sexo, grupo y región, e ignora documentos inválidos', () => {
    const p = { sexo: 'femenino' as const, edadAnios: 0, edadMeses: 5 };
    const a = construirRegistro({ codigo: 'WPW-AAAAAA', modo: 'guiado', paciente: p, criterios: ENTRADA_VACIA, resultado: aplicarArruda(e({ deltaI: 'negativa', deltaAVF: 'positiva' })) });
    const septal = e({ deltaI: 'positiva', rsV1: 'r_menor_igual_s', deltaII: 'positiva', deltaV1: 'negativa', deltaAVF: 'isoelectrica' });
    const b = construirRegistro({ codigo: 'WPW-AAAAAA', modo: 'guiado', paciente: { ...p, sexo: 'masculino', edadAnios: 14 }, criterios: septal, resultado: aplicarArruda(septal) });
    const c = construirRegistro({ codigo: 'WPW-AAAAAA', modo: 'guiado', paciente: p, criterios: ENTRADA_VACIA, resultado: aplicarArruda(ENTRADA_VACIA) });
    const r = resumir([a, b, c, null, { basura: 1 }, 'x']);
    expect(r.total).toBe(3);
    expect(r.porSexo).toEqual({ femenino: 2, masculino: 1 });
    expect(r.porGrupo).toEqual({ lactante: 2, adolescente: 1 });
    expect(r.porRegion).toEqual({ LL_LAL: 1, 'PSTA o PSMA': 1 });
    expect(r.porEstado).toEqual({ region_predicha: 2, datos_insuficientes: 1 });
    expect(r.conEEF).toBe(0);
    expect(r.pendientesEEF).toHaveLength(3);
  });

  it('cuenta la concordancia con el EEF y separa los pendientes', () => {
    const p = { sexo: 'femenino' as const, edadAnios: 9, edadMeses: 0 };
    const izq = e({ deltaI: 'negativa', deltaAVF: 'positiva' }); // LL/LAL
    const base = (codigo: string, eef: ReturnType<typeof construirEEF> | null, creadoEn: string) => ({
      ...construirRegistro({ codigo, modo: 'guiado', paciente: p, criterios: izq, resultado: aplicarArruda(izq), eef }),
      creadoEn,
    });
    const r = resumir([
      base('WPW-AAAAA2', construirEEF(['LL_LAL'], 'LL', 'ablacion_exitosa'), '2026-01-01'),
      base('WPW-AAAAA3', construirEEF(['LL_LAL'], 'LP', null), '2026-01-02'),
      base('WPW-AAAAA4', construirEEF(['LL_LAL'], 'MULTIPLES', null), '2026-01-03'),
      base('WPW-AAAAA5', null, '2026-01-04'),
      base('WPW-AAAAA6', null, '2026-02-01'),
    ]);
    expect(r.conEEF).toBe(3);
    expect(r.porConcordancia).toEqual({ concordante: 1, discordante: 1, no_evaluable: 1 });
    expect(tasaConcordancia(r)).toEqual({ aciertos: 1, parciales: 0, comparables: 2 });
    expect(r.pendientesEEF.map((x) => x.codigo)).toEqual(['WPW-AAAAA6', 'WPW-AAAAA5']);
  });

  it('guarda las predicciones de los dos algoritmos y compara sus aciertos con el EEF', () => {
    const p = { sexo: 'masculino' as const, edadAnios: 12, edadMeses: 0 };
    // EASY-WPW: izquierda anterolateral; Arruda: LP/LPL (aVF negativa)
    const criterios = e({ qrsV1: 'positiva', deltaMasPositiva: 'iii', deltaI: 'negativa', deltaAVF: 'negativa' });
    const easy = aplicarEasyWPW(criterios);
    const arruda = aplicarArruda(criterios);
    const reg = (codigo: string, loc: 'LAL' | 'LP' | 'RL') => {
      const preds = { easy_wpw: easy.regiones.map((x) => x.codigo), arruda: arruda.regiones.map((x) => x.codigo) };
      return construirRegistro({
        codigo, modo: 'imagen', paciente: p, criterios, resultado: easy, comparaciones: [arruda],
        eef: construirEEF(preds.easy_wpw, loc, 'ablacion_exitosa', preds),
      });
    };
    const a = reg('WPW-AAAAA2', 'LAL');
    expect(a.algoritmo).toBe('easy_wpw');
    expect(a.predicciones).toEqual({
      easy_wpw: { estado: 'region_predicha', regiones: ['LL_LAL'], version: easy.versionAlgoritmo },
      arruda: { estado: 'region_predicha', regiones: ['LP_LPL'], version: arruda.versionAlgoritmo },
    });
    expect(a.eef?.concordancias).toEqual({ easy_wpw: 'concordante', arruda: 'discordante' });

    const r = resumir([a, reg('WPW-AAAAA3', 'LP'), reg('WPW-AAAAA4', 'RL')]);
    expect(r.porAlgoritmo.easy_wpw).toEqual({ casos: 3, coincide: 1, parcial: 0, noCoincide: 2, sinPrediccion: 0, conHora: 0, sumaHoras: 0 });
    expect(r.porAlgoritmo.arruda).toEqual({ casos: 3, coincide: 1, parcial: 0, noCoincide: 2, sinPrediccion: 0, conHora: 0, sumaHoras: 0 });
    expect(r.pareados.find((x) => x.a === 'easy_wpw' && x.b === 'arruda')).toEqual({ a: 'easy_wpw', b: 'arruda', casos: 3, ambos: 0, soloA: 1, soloB: 1, ninguno: 1 });
    expect(r.pareados.find((x) => x.a === 'smart_wpw' && x.b === 'arruda')?.casos).toBe(0);
  });

  it('acumula el error en horas por algoritmo', () => {
    const p = { sexo: 'femenino' as const, edadAnios: 6, edadMeses: 0 };
    const criterios = e({ qrsV1: 'positiva', deltaMasPositiva: 'iii', deltaI: 'negativa', deltaAVF: 'negativa' });
    const easy = aplicarEasyWPW(criterios); // IL/IAL (mitral I–III)
    const arruda = aplicarArruda(criterios); // IP/IPL (mitral IV–VII)
    const preds = { easy_wpw: ['LL_LAL'], arruda: ['LP_LPL'] };
    const reg = (codigo: string, sitio: 'MV_2' | 'MV_6') =>
      construirRegistro({ codigo, modo: 'imagen', paciente: p, criterios, resultado: easy, comparaciones: [arruda], eef: construirEEF(['LL_LAL'], sitio, null, preds) });
    const r = resumir([reg('WPW-AAAAB2', 'MV_2'), reg('WPW-AAAAB3', 'MV_6')]);
    expect(r.porAlgoritmo.easy_wpw).toMatchObject({ conHora: 2, sumaHoras: 0 + 3 });
    expect(r.porAlgoritmo.arruda).toMatchObject({ conHora: 2, sumaHoras: 2 + 0 });
  });

  it('SMART-WPW se compara con el EEF por hora exacta del sector', () => {
    const p = { sexo: 'femenino' as const, edadAnios: 11, edadMeses: 0 };
    // SMART: tricuspídeo septal, solo III negativa → MS (III)
    const criterios = e({ deltaV1: 'negativa', qrsV3: 'positiva', deltaIII: 'negativa', deltaAVF: 'positiva', deltaII: 'positiva' });
    const smart = aplicarSmartWPW(criterios);
    expect(smart.sector).toMatchObject({ anillo: 'TV', horas: [3], sigla: 'MS' });
    const reg = (codigo: string, sitio: 'TV_3' | 'TV_4') => {
      const preds = prediccionesDeResultados(smart, []);
      const comparables = { smart_wpw: { regiones: preds.smart_wpw!.regiones, sector: preds.smart_wpw!.sector } };
      return construirRegistro({ codigo, modo: 'imagen', paciente: p, criterios, resultado: smart, eef: construirEEF(comparables.smart_wpw, sitio, null, comparables) });
    };
    const ok = reg('WPW-AAAAC2', 'TV_3');
    expect(ok.predicciones.smart_wpw?.sector).toEqual({ anillo: 'TV', horas: [3], sigla: 'MS' });
    expect(ok.eef?.concordancia).toBe('concordante');
    // TV IV: por región sería compatible (MST), pero el sector de SMART es III → no coincide, a 1 hora.
    const cerca = reg('WPW-AAAAC3', 'TV_4');
    expect(cerca.eef?.concordancia).toBe('discordante');
    expect(cerca.eef?.distanciaHoras).toBe(1);
    const r = resumir([ok, cerca]);
    expect(r.porAlgoritmo.smart_wpw).toMatchObject({ casos: 2, coincide: 1, noCoincide: 1, conHora: 2, sumaHoras: 1 });
  });

  it('los registros anteriores (sin predicciones) cuentan como Arruda', () => {
    const p = { sexo: 'femenino' as const, edadAnios: 9, edadMeses: 0 };
    const izq = e({ deltaI: 'negativa', deltaAVF: 'positiva' });
    const viejo: Record<string, unknown> = { ...construirRegistro({ codigo: 'WPW-AAAAA7', modo: 'guiado', paciente: p, criterios: izq, resultado: aplicarArruda(izq), eef: construirEEF(['LL_LAL'], 'LL', null) }) };
    delete viejo.predicciones;
    delete viejo.algoritmo;
    expect(prediccionesDe(viejo).arruda?.regiones).toEqual(['LL_LAL']);
    expect(resumir([viejo]).porAlgoritmo).toEqual({ arruda: { casos: 1, coincide: 1, parcial: 0, noCoincide: 0, sinPrediccion: 0, conHora: 0, sumaHoras: 0 } });
  });

  it('fuera de claude.ai no hay repositorio', async () => {
    expect(await obtenerRepositorioClaude()).toBeNull();
  });
});

describe('Estudio electrofisiológico', () => {
  it.each([
    [['LL_LAL'], 'LAL', 'concordante'],
    [['LL_LAL'], 'LL', 'concordante'],
    [['LP_LPL'], 'LPL', 'concordante'],
    [['PSTA_CSOS'], 'PSTA', 'concordante'],
    [['PSTA_CSOS'], 'CSOS', 'concordante'],
    [['PS_SUBEPI'], 'PS_SUBEPI', 'concordante'],
    [['AS_RAPS'], 'AS_PH', 'concordante'],
    [['MSTA'], 'MS', 'concordante'],
    [['RA_RAL'], 'RAL', 'concordante'],
    [['RL'], 'RL', 'concordante'],
    [['RP_RPL'], 'RP', 'concordante'],
    [['PSTA', 'PSMA'], 'PSMA', 'parcial'],
    [['PSTA', 'PSMA'], 'PSTA', 'parcial'],
    [['PSTA', 'PSMA'], 'LL', 'discordante'],
    [['LL_LAL'], 'RL', 'discordante'],
    [['PS_SUBEPI'], 'PSTA', 'discordante'],
    [[], 'LL', 'sin_prediccion'],
    [['LL_LAL'], 'MULTIPLES', 'no_evaluable'],
    [[], 'NO_LOCALIZADA', 'no_evaluable'],
  ] as const)('predicción %j frente a EEF %s → %s', (pred, eef, esperado) => {
    expect(evaluarConcordancia(pred, eef)).toBe(esperado);
  });

  it('cada región de Arruda tiene al menos un sitio de EEF que coincide', () => {
    const cubiertas = new Set(LOCALIZACIONES_EEF.flatMap((l) => l.compatibles));
    for (const codigo of Object.keys(REGIONES)) expect(cubiertas.has(codigo as never)).toBe(true);
  });

  it('criterio horario: cada hora de cada anillo es un sitio cargable', () => {
    const horas = LOCALIZACIONES_EEF.filter((l) => l.anillo);
    expect(horas).toHaveLength(24);
    expect(POR_CODIGO_EEF.TV_5.nombre).toBe('Tricuspídeo V (posteroseptal)');
    expect(POR_CODIGO_EEF.MV_4.nombre).toBe('Mitral IV (posterolateral alta)');
  });

  it.each([
    [['PSTA'], 'TV_5', 'concordante'],
    [['PSTA_CSOS'], 'TV_4', 'concordante'], // TV IV: medioseptal posterior (provisorio: MST o PST)
    [['MSTA'], 'TV_4', 'concordante'],
    [['AS_RAPS'], 'TV_2', 'concordante'],
    [['RA_RAL'], 'TV_11', 'concordante'],
    [['RL'], 'TV_9', 'concordante'],
    [['RP_RPL'], 'TV_8', 'concordante'],
    [['LL_LAL'], 'MV_3', 'concordante'],
    [['LP_LPL'], 'MV_5', 'concordante'],
    [['PSMA'], 'MV_7', 'concordante'], // MV VI–VII: posteroseptal / posterior
    [['LP_LPL'], 'MV_7', 'concordante'],
    [['PSMA'], 'MV_4', 'discordante'],
    [['LL_LAL'], 'MV_11', 'discordante'], // continuidad mitroaórtica: ningún algoritmo la predice
    [['PSTA'], 'MV_8', 'discordante'],
    [['PS_SUBEPI'], 'PS_SUBEPI', 'concordante'],
  ] as const)('predicción %j frente a %s → %s', (pred, eef, esperado) => {
    expect(evaluarConcordancia(pred, eef)).toBe(esperado);
  });

  it('mide la distancia en horas sobre el mismo anillo', () => {
    expect(distanciaHoras(['LL_LAL'], 'MV_2')).toBe(0);
    expect(distanciaHoras(['LL_LAL'], 'MV_5')).toBe(2);
    expect(distanciaHoras(['RA_RAL'], 'TV_2')).toBe(2); // por XII, pasando por I
    expect(distanciaHoras(['PSTA', 'PSMA'], 'TV_6')).toBe(1); // dos opciones: la más cercana
    expect(distanciaHoras(['LL_LAL'], 'TV_3')).toBeNull(); // otro anillo
    expect(distanciaHoras(['PS_SUBEPI'], 'TV_5')).toBeNull(); // región sin horas
    expect(distanciaHoras(['LL_LAL'], 'LL')).toBeNull(); // código anterior, sin hora
  });

  it('los códigos anteriores tienen una hora equivalente y siguen evaluándose igual', () => {
    for (const [viejo, hora] of Object.entries(LEGADO_A_HORA)) {
      const v = POR_CODIGO_EEF[viejo as keyof typeof LEGADO_A_HORA];
      const h = POR_CODIGO_EEF[hora];
      // La hora equivalente coincide con al menos una de las regiones del código anterior.
      expect(v.compatibles.some((r) => h.compatibles.includes(r))).toBe(true);
    }
  });

  it('construirEEF guarda anillo, hora y distancia', () => {
    expect(construirEEF(['LL_LAL'], 'MV_5', null, { easy_wpw: ['LP_LPL'], arruda: ['LL_LAL'] })).toEqual({
      localizacion: 'MV_5', anillo: 'MV', hora: 5, fuente: null, concordancia: 'discordante', distanciaHoras: 2,
      concordancias: { easy_wpw: 'concordante', arruda: 'discordante' }, distancias: { easy_wpw: 0, arruda: 2 },
    });
  });

  it('genera códigos válidos y los normaliza', () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigo();
      expect(c).toMatch(/^WPW-[2-9A-HJKMNP-Z]{6}$/);
      expect(normalizarCodigo(c)).toBe(c);
    }
    expect(normalizarCodigo(' wpw-7f3kab ')).toBe('WPW-7F3KAB');
    expect(normalizarCodigo('7F3KAB')).toBe('WPW-7F3KAB');
    expect(normalizarCodigo('WPW-7F3KA')).toBeNull(); // corto
    expect(normalizarCodigo('WPW-0OIL11')).toBeNull(); // caracteres ambiguos
  });
});
