import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { aplicarArruda, ENTRADA_VACIA } from '../algoritmo/arruda';
import { REGIONES } from '../algoritmo/catalogo';
import type { CodigoRegion, EntradaECG } from '../algoritmo/tipos';
import { SEGMENTOS } from '../componentes/DiagramaAnillos';
import { PanelResultado } from '../componentes/PanelResultado';
import { ubicacionRegion } from '../corazon3d/escena';
import referencias from '../corazon3d/modelo/referencias.json';

const e = (p: Partial<EntradaECG>): EntradaECG => ({ ...ENTRADA_VACIA, ...p });

describe('Botón 3D location', () => {
  it('aparece con región predicha y abre el visor (sin WebGL en el entorno de pruebas)', async () => {
    const u = userEvent.setup();
    render(<PanelResultado resultado={aplicarArruda(e({ deltaI: 'negativa', deltaAVF: 'positiva' }))} desactualizado={false} onReiniciar={() => {}} />);
    await u.click(screen.getByRole('button', { name: '3D location' }));
    const visor = screen.getByRole('dialog', { name: '3D location' });
    expect(visor).toHaveTextContent('Vía accesoria predicha: LL/LAL');
    expect(within(visor).getByTestId('sin-webgl')).toBeInTheDocument();
    expect(visor).toHaveTextContent('adulto de referencia, no del paciente');
    expect(visor).toHaveTextContent('Z-Anatomy');
    expect(visor).toHaveTextContent('CC BY-SA 4.0');
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra las dos opciones cuando el algoritmo no discrimina (PSTA o PSMA)', async () => {
    const u = userEvent.setup();
    const r = aplicarArruda(e({ deltaI: 'positiva', rsV1: 'r_menor_igual_s', deltaII: 'positiva', deltaV1: 'negativa', deltaAVF: 'isoelectrica' }));
    render(<PanelResultado resultado={r} desactualizado={false} onReiniciar={() => {}} />);
    await u.click(screen.getByRole('button', { name: '3D location' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('PSTA o PSMA');
    await u.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no aparece sin región predicha y se desactiva si el resultado quedó desactualizado', () => {
    const { rerender } = render(<PanelResultado resultado={aplicarArruda(ENTRADA_VACIA)} desactualizado={false} onReiniciar={() => {}} />);
    expect(screen.queryByRole('button', { name: '3D location' })).not.toBeInTheDocument();
    rerender(<PanelResultado resultado={aplicarArruda(e({ deltaI: 'negativa', deltaAVF: 'positiva' }))} desactualizado onReiniciar={() => {}} />);
    expect(screen.getByRole('button', { name: '3D location' })).toBeDisabled();
  });
});

describe('Ubicación del LED en el modelo anatómico', () => {
  const A = referencias.anillos;
  const rel = (c: CodigoRegion, a: typeof A.mitral) => {
    const p = ubicacionRegion(c);
    const d = [p.x - a.centro[0], p.y - a.centro[1], p.z - a.centro[2]];
    const dot = (u: number[]) => d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    return { dist: Math.hypot(...d), arriba: dot(a.arriba), derecha: dot(a.derecha) };
  };

  it('las regiones de los anillos quedan sobre su anillo', () => {
    for (const codigo of Object.keys(REGIONES) as CodigoRegion[]) {
      const s = SEGMENTOS[codigo]![0];
      if (s.anillo === 'sc' || codigo === 'PSTA_CSOS') continue;
      const a = s.anillo === 't' ? A.tricuspide : A.mitral;
      expect(rel(codigo, a).dist).toBeCloseTo(a.radio, 3);
    }
  });

  it('respeta la orientación del esquema 2D', () => {
    // Pared libre izquierda hacia la izquierda del paciente; pared libre derecha hacia la derecha
    expect(rel('LL_LAL', A.mitral).derecha).toBeGreaterThan(0);
    expect(rel('RL', A.tricuspide).derecha).toBeLessThan(0);
    // Anterior arriba, posterior abajo
    expect(rel('RA_RAL', A.tricuspide).arriba).toBeGreaterThan(rel('RP_RPL', A.tricuspide).arriba);
    expect(rel('LL_LAL', A.mitral).arriba).toBeGreaterThan(rel('LP_LPL', A.mitral).arriba);
    // Septales de la tricúspide del lado del septum (hacia el mitral)
    expect(rel('MSTA', A.tricuspide).derecha).toBeGreaterThan(0);
  });

  it('la vía subepicárdica está en el seno coronario y PSTA/CSOs junto al ostium', () => {
    expect(ubicacionRegion('PS_SUBEPI').toArray()).toEqual(referencias.sitios.subepicardica);
    const p = ubicacionRegion('PSTA_CSOS');
    const o = referencias.sitios.ostium;
    const anillo = rel('PSTA', A.tricuspide);
    expect(Math.hypot(p.x - o[0], p.y - o[1], p.z - o[2])).toBeLessThan(anillo.dist + 3);
  });
});

describe('Modelo anatómico extraído', () => {
  it('tiene el sistema de conducción completo y orientación coherente', () => {
    for (const t of ['internodal_anterior', 'internodal_medio', 'internodal_posterior', 'bachmann', 'his', 'rama_derecha', 'rama_izquierda']) {
      expect((referencias.trayectos as Record<string, unknown[]>)[t].length).toBeGreaterThan(2);
    }
    expect(referencias.purkinje.length).toBeGreaterThanOrEqual(5);
    // Ventrículo izquierdo a la izquierda del paciente (+x); nódulo sinusal arriba del nódulo AV
    expect(referencias.centros.ventriculo_izquierdo[0]).toBeGreaterThan(referencias.centros.ventriculo_derecho[0]);
    expect(referencias.nodos.sinusal[1]).toBeGreaterThan(referencias.nodos.auriculoventricular[1]);
    // Mitral a la izquierda de la tricúspide
    expect(referencias.anillos.mitral.centro[0]).toBeGreaterThan(referencias.anillos.tricuspide.centro[0]);
  });
});

describe('Modelo embebido', () => {
  it('se decodifica sin fetch y es un GLB sin compresión que requiera WebAssembly', async () => {
    const { decodificarModelo } = await import('../corazon3d/escena');
    const { default: modelo } = await import('../corazon3d/modelo/corazon.glb?inline');
    expect(modelo.startsWith('data:')).toBe(true);
    const buf = decodificarModelo(modelo);
    const v = new DataView(buf);
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe('glTF');
    expect(v.getUint32(8, true)).toBe(buf.byteLength); // largo declarado en la cabecera del GLB
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, v.getUint32(12, true))));
    expect(json.extensionsUsed ?? []).not.toContain('EXT_meshopt_compression');
  });
});
