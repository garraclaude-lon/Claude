import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { aplicarArruda, ENTRADA_VACIA } from '../algoritmo/arruda';
import { REGIONES } from '../algoritmo/catalogo';
import type { CodigoRegion, EntradaECG } from '../algoritmo/tipos';
import { SEGMENTOS } from '../componentes/DiagramaAnillos';
import { PanelResultado } from '../componentes/PanelResultado';
import { ubicacionRegion } from '../corazon3d/escena';

const e = (p: Partial<EntradaECG>): EntradaECG => ({ ...ENTRADA_VACIA, ...p });

describe('Botón 3D location', () => {
  it('aparece con región predicha y abre el visor (sin WebGL en el entorno de pruebas)', async () => {
    const u = userEvent.setup();
    render(<PanelResultado resultado={aplicarArruda(e({ deltaI: 'negativa', deltaAVF: 'positiva' }))} desactualizado={false} onReiniciar={() => {}} />);
    await u.click(screen.getByRole('button', { name: '3D location' }));
    const visor = screen.getByRole('dialog', { name: '3D location' });
    expect(visor).toHaveTextContent('Vía accesoria predicha: LL/LAL');
    expect(within(visor).getByTestId('sin-webgl')).toBeInTheDocument();
    expect(visor).toHaveTextContent('no es una reconstrucción anatómica ni del paciente');
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

describe('Ubicación del LED en el modelo 3D', () => {
  it('cada región tiene una ubicación sobre el anillo que le corresponde', () => {
    const TA = { x: -1.0, z: 0.15, r: 0.8 };
    const MA = { x: 0.95, z: -0.15, r: 0.75 };
    for (const codigo of Object.keys(REGIONES) as CodigoRegion[]) {
      const s = SEGMENTOS[codigo]![0];
      const p = ubicacionRegion(codigo);
      if (s.anillo === 'sc') {
        expect(Math.hypot(p.x - MA.x, p.z - MA.z)).toBeGreaterThan(MA.r);
        expect(p.y).toBeLessThan(0);
      } else {
        const a = s.anillo === 't' ? TA : MA;
        expect(Math.hypot(p.x - a.x, p.z - a.z)).toBeCloseTo(a.r + 0.02, 5);
        expect(p.y).toBe(0);
      }
    }
  });

  it('lado izquierdo en el mitral, lado derecho en la tricúspide', () => {
    expect(ubicacionRegion('LL_LAL').x).toBeGreaterThan(0.95);
    expect(ubicacionRegion('RL').x).toBeLessThan(-1.0);
    // Anterior (+z) frente a posterior (−z)
    expect(ubicacionRegion('RA_RAL').z).toBeGreaterThan(ubicacionRegion('RP_RPL').z);
  });
});
