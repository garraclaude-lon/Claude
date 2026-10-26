import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

async function elegir(usuario: ReturnType<typeof userEvent.setup>, campo: string, opcion: string) {
  const grupo = screen.getByRole('group', { name: campo });
  await usuario.click(within(grupo).getByRole('radio', { name: opcion }));
}

describe('Interfaz', () => {
  it('muestra encabezado, subtítulo y aviso de prototipo', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WPW Navigator 3D by Longa');
    expect(screen.getByText('Localización de vías accesorias — Algoritmo de Arruda')).toBeInTheDocument();
    expect(screen.getByText(/Prototipo de investigación/)).toBeInTheDocument();
  });

  it('calcula LL/LAL y la ruta mostrada coincide con el resultado', async () => {
    const u = userEvent.setup();
    render(<App />);
    await elegir(u, 'Onda delta en I', 'Negativa');
    await elegir(u, 'Onda delta en aVF', 'Positiva');
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));

    const panel = screen.getByTestId('panel-resultado');
    expect(within(panel).getByTestId('estado')).toHaveTextContent('Región predicha');
    const regiones = within(panel).getAllByTestId('region');
    expect(regiones).toHaveLength(1);
    expect(regiones[0]).toHaveTextContent('LL/LAL');
    const ruta = within(panel).getByTestId('ruta');
    expect(within(ruta).getAllByRole('listitem')).toHaveLength(1);
    expect(ruta).toHaveTextContent('LL/LAL');
    expect(panel).toHaveTextContent('No es una localización confirmada');
    expect(panel).toHaveTextContent('J Cardiovasc Electrophysiol');
    expect(panel).toHaveTextContent('arruda-1998-impl-0.1.0');
  });

  it('con el formulario vacío pide los datos faltantes del paso 1', async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));
    const panel = screen.getByTestId('panel-resultado');
    expect(within(panel).getByTestId('estado')).toHaveTextContent('Datos insuficientes');
    expect(panel).toHaveTextContent('Onda delta en I');
    expect(panel).toHaveTextContent('Relación R/S en V1');
    expect(within(panel).queryAllByTestId('region')).toHaveLength(0);
    expect(screen.getByRole('group', { name: 'Onda delta en I' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('avisa si se modifican los datos después de calcular', async () => {
    const u = userEvent.setup();
    render(<App />);
    await elegir(u, 'Onda delta en I', 'Negativa');
    await elegir(u, 'Onda delta en aVF', 'Positiva');
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));
    await elegir(u, 'Onda delta en aVF', 'Negativa');
    expect(screen.getByText(/Modificaste los datos/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));
    expect(screen.queryByText(/Modificaste los datos/)).not.toBeInTheDocument();
    expect(screen.getByTestId('region')).toHaveTextContent('LP/LPL');
  });

  it('reiniciar limpia el formulario y el resultado', async () => {
    const u = userEvent.setup();
    render(<App />);
    await elegir(u, 'Onda delta en I', 'Negativa');
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));
    await u.click(screen.getByRole('button', { name: 'Reiniciar formulario' }));
    expect(screen.queryByTestId('panel-resultado')).not.toBeInTheDocument();
    const grupo = screen.getByRole('group', { name: 'Onda delta en I' });
    within(grupo).getAllByRole('radio').forEach((r) => expect(r).not.toBeChecked());
  });
});
