import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { RegistroAnalisis, Repositorio } from '../registro/registro';

function repositorioFalso() {
  const guardados = new Map<string, RegistroAnalisis>();
  let n = 0;
  const oyentes = new Set<(r: unknown[]) => void>();
  const avisar = () => oyentes.forEach((f) => f([...guardados.values()]));
  const repo: Repositorio = {
    guardar: vi.fn(async (id, reg) => {
      const clave = id ?? `doc${++n}`;
      guardados.set(clave, reg);
      avisar();
      return clave;
    }),
    escuchar: (f) => {
      oyentes.add(f);
      f([...guardados.values()]);
      return () => oyentes.delete(f);
    },
  };
  return { repo, guardados };
}

type Usuario = ReturnType<typeof userEvent.setup>;
const opcion = (u: Usuario, texto: string) =>
  u.click(within(screen.getByTestId('pregunta')).getAllByRole('button').find((b) => b.textContent === texto)!);

describe('Registro de análisis', () => {
  it('guarda, actualiza el mismo registro tras un cambio y muestra el resumen', async () => {
    const u = userEvent.setup();
    const { repo, guardados } = repositorioFalso();
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => repo} />);
    expect(await screen.findByText(/Todavía no hay análisis guardados/)).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: /Cuestionario guiado/ }));
    await u.click(screen.getByRole('radio', { name: 'Femenino' }));
    await u.type(screen.getByLabelText('Años'), '0');
    await u.type(screen.getByLabelText('Meses'), '0');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await opcion(u, 'Negativa'); // I
    await opcion(u, 'Positiva'); // aVF
    await u.click(screen.getByRole('button', { name: 'Guardar en el registro' }));
    expect(await screen.findByTestId('registro-guardado')).toBeInTheDocument();
    expect(guardados.size).toBe(1);
    expect(guardados.get('doc1')).toMatchObject({
      modo: 'guiado',
      paciente: { sexo: 'femenino', grupoEtario: 'neonato' },
      resultado: { regiones: ['LL_LAL'] },
    });

    // Corrige aVF: se actualiza el mismo registro, no se crea otro.
    await u.click(screen.getByRole('button', { name: '← Atrás' }));
    await opcion(u, 'Negativa');
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByTestId('registro-guardado');
    expect(guardados.size).toBe(1);
    expect(guardados.get('doc1')?.resultado.regiones).toEqual(['LP_LPL']);
    expect(repo.guardar).toHaveBeenLastCalledWith('doc1', expect.anything());

    // Corregir la edad después de guardar pide guardar los cambios.
    await u.click(screen.getByRole('button', { name: 'Corregir' }));
    await u.clear(screen.getByLabelText('Meses'));
    await u.type(screen.getByLabelText('Meses'), '3');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByTestId('registro-guardado');
    expect(guardados.get('doc1')?.paciente.grupoEtario).toBe('lactante');

    await u.click(screen.getByRole('button', { name: 'Analizar otro paciente' }));
    expect(screen.getByTestId('resumen-total')).toHaveTextContent('1 análisis guardado');
  });

  it('sin base de datos lo avisa y no ofrece guardar', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => null} />);
    await u.click(screen.getByRole('button', { name: /Cuestionario guiado/ }));
    await u.click(screen.getByRole('radio', { name: 'Masculino' }));
    await u.type(screen.getByLabelText('Años'), '10');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await opcion(u, 'Negativa');
    await opcion(u, 'Positiva');
    expect(screen.getByTestId('registro-no-disponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar en el registro' })).not.toBeInTheDocument();
  });

  it('informa si no hay permiso para guardar', async () => {
    const u = userEvent.setup();
    const repo: Repositorio = { guardar: async () => Promise.reject({ code: 'invalid_argument' }), escuchar: () => () => {} };
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => repo} />);
    await u.click(screen.getByRole('button', { name: /Cuestionario guiado/ }));
    await u.click(screen.getByRole('radio', { name: 'Masculino' }));
    await u.type(screen.getByLabelText('Años'), '10');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await opcion(u, 'Negativa');
    await opcion(u, 'Positiva');
    await u.click(screen.getByRole('button', { name: 'Guardar en el registro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Colaborador');
  });
});
