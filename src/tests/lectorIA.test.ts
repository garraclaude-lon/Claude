import { describe, expect, it } from 'vitest';
import { ENTRADA_VACIA } from '../algoritmo/arruda';
import { interpretarRespuestaIA, mensajeErrorIA, obtenerLectorClaude } from '../ia/lectorIA';
import { clasificarArchivo } from '../imagen/preparar';

describe('interpretarRespuestaIA', () => {
  it('acepta valores válidos', () => {
    const p = interpretarRespuestaIA({
      esECG: true, calidad: 'buena',
      deltaI: 'negativa', deltaII: 'positiva', deltaAVF: 'isoelectrica', deltaV1: 'no_evaluable',
      deltaAVR: 'positiva', rsV1: 'r_mayor_s', rsIII: 'iguales',
      qrsV1: 'negativa', transicionQRS: 'hasta_v3', deltaMasPositiva: 'avl',
      deltaIII: 'negativa', qrsV3: 'positiva',
      comentarios: { deltaI: '  inicio negativo  ' }, observacionGeneral: 'ok',
    });
    expect(p.valores).toEqual({
      deltaI: 'negativa', deltaII: 'positiva', deltaAVF: 'isoelectrica', deltaV1: 'no_evaluable',
      deltaAVR: 'positiva', rsV1: 'r_mayor_s', rsIII: 'iguales',
      qrsV1: 'negativa', transicionQRS: 'hasta_v3', deltaMasPositiva: 'avl',
      deltaIII: 'negativa', qrsV3: 'positiva',
    });
    expect(p.comentarios.deltaI).toBe('inicio negativo');
    expect(p.calidad).toBe('buena');
  });

  it('descarta valores fuera de las opciones (nunca los adivina)', () => {
    const p = interpretarRespuestaIA({ deltaI: 'Negativa', rsV1: 'r_menor_s', rsIII: 'r_menor_igual_s', deltaII: 3, transicionQRS: 'V3', deltaMasPositiva: 'I' });
    expect(p.valores).toEqual(ENTRADA_VACIA);
  });

  it('una respuesta no válida deja todo vacío', () => {
    for (const r of [null, 'texto', [1, 2], 42]) {
      const p = interpretarRespuestaIA(r);
      expect(p.valores).toEqual(ENTRADA_VACIA);
      expect(p.calidad).toBeNull();
    }
  });

  it('si la IA dice que no es un ECG, todo queda no evaluable', () => {
    const p = interpretarRespuestaIA({ esECG: false, deltaI: 'negativa' });
    expect(Object.values(p.valores).every((v) => v === 'no_evaluable')).toBe(true);
  });
});

describe('Disponibilidad y errores de la IA', () => {
  it('fuera de claude.ai no hay lector', async () => {
    expect(await obtenerLectorClaude()).toBeNull();
  });

  it('traduce los códigos de error', () => {
    expect(mensajeErrorIA({ code: 'not_granted' })).toMatch(/no está habilitada/);
    expect(mensajeErrorIA({ code: 'desconocido' })).toMatch(/No se pudo/);
  });
});

describe('clasificarArchivo', () => {
  it.each([
    ['ecg.jpg', 'image/jpeg', 'imagen_directa'],
    ['ecg.PNG', '', 'imagen_directa'],
    ['ecg.bmp', 'image/bmp', 'imagen_convertir'],
    ['foto.webp', 'image/webp', 'imagen_convertir'],
    ['estudio.pdf', 'application/pdf', 'pdf'],
    ['notas.txt', 'text/plain', 'no_soportado'],
  ])('%s (%s) → %s', (nombre, tipo, esperado) => {
    expect(clasificarArchivo(nombre, tipo)).toBe(esperado);
  });
});
