import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { RegistroGuardado, Repositorio } from '../registro/registro';

function repositorioFalso() {
  const guardados = new Map<string, RegistroGuardado>();
  const oyentes = new Set<(r: unknown[]) => void>();
  const avisar = () => oyentes.forEach((f) => f([...guardados.values()]));
  const repo: Repositorio = {
    guardar: vi.fn(async (reg) => {
      const previo = guardados.get(reg.codigo);
      guardados.set(reg.codigo, { ...reg, creadoEn: previo?.creadoEn ?? new Date().toISOString() });
      avisar();
    }),
    obtener: async (codigo) => guardados.get(codigo) ?? null,
    actualizarEEF: vi.fn(async (codigo, eef) => {
      const r = guardados.get(codigo);
      if (!r) throw { code: 'invalid_argument' };
      guardados.set(codigo, { ...r, eef });
      avisar();
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

async function analizarIzquierda(u: Usuario, meses = '0') {
  await u.click(screen.getByRole('button', { name: /Cuestionario guiado/ }));
  await u.click(screen.getByRole('radio', { name: 'Femenino' }));
  await u.type(screen.getByLabelText('Años'), '0');
  await u.type(screen.getByLabelText('Meses'), meses);
  await u.click(screen.getByRole('button', { name: 'Continuar' }));
  await opcion(u, 'Negativa'); // I
  await opcion(u, 'Positiva'); // aVF → LL/LAL
}

const selectorEEF = () => screen.getByLabelText('Localización confirmada en el estudio electrofisiológico');
/** Carga el sitio con el criterio horario: anillo y hora (I–XII). */
async function elegirSitio(u: ReturnType<typeof userEvent.setup>, anillo: 'TV' | 'MV', hora: number) {
  await u.selectOptions(selectorEEF(), anillo);
  await u.selectOptions(screen.getByLabelText(/^Hora en el anillo/), String(hora));
}

describe('Registro de análisis', () => {
  it('guarda con código, actualiza el mismo registro tras un cambio y muestra el resumen', async () => {
    const u = userEvent.setup();
    const { repo, guardados } = repositorioFalso();
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => repo} />);
    expect(await screen.findByText(/Todavía no hay análisis guardados/)).toBeInTheDocument();

    await analizarIzquierda(u);
    await u.click(screen.getByRole('button', { name: 'Guardar en el registro' }));
    expect(await screen.findByTestId('registro-guardado')).toBeInTheDocument();
    const codigo = screen.getByTestId('codigo-registro').querySelector('span')!.textContent!;
    expect(codigo).toMatch(/^WPW-[2-9A-HJKMNP-Z]{6}$/);
    expect(guardados.size).toBe(1);
    expect(guardados.get(codigo)).toMatchObject({
      modo: 'guiado',
      paciente: { sexo: 'femenino', grupoEtario: 'neonato' },
      resultado: { regiones: ['LL_LAL'] },
      eef: null,
    });

    // Corrige aVF: mismo registro, mismo código.
    await u.click(screen.getByRole('button', { name: '← Atrás' }));
    await opcion(u, 'Negativa');
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByTestId('registro-guardado');
    expect(guardados.size).toBe(1);
    expect(guardados.get(codigo)?.resultado.regiones).toEqual(['LP_LPL']);

    // Corregir la edad después de guardar pide guardar los cambios.
    await u.click(screen.getByRole('button', { name: 'Corregir' }));
    await u.clear(screen.getByLabelText('Meses'));
    await u.type(screen.getByLabelText('Meses'), '3');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByTestId('registro-guardado');
    expect(guardados.get(codigo)?.paciente.grupoEtario).toBe('lactante');

    await u.click(screen.getByRole('button', { name: 'Analizar otro paciente' }));
    expect(screen.getByTestId('resumen-total')).toHaveTextContent('1 análisis guardado');
    expect(screen.getByTestId('tabla-pendientes')).toHaveTextContent(codigo);
  });

  it('permite cargar el EEF al guardar y muestra la concordancia', async () => {
    const u = userEvent.setup();
    const { repo, guardados } = repositorioFalso();
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => repo} />);
    await analizarIzquierda(u);
    // Predicción IL/IAL (mitral I–III). Sitio en mitral V → no coincide, a 2 horas.
    await elegirSitio(u, 'MV', 5);
    expect(screen.getByTestId('concordancia-eef')).toHaveTextContent('No coincide');
    expect(screen.getByTestId('concordancia-eef')).toHaveTextContent('a 2 horas del sitio');
    // Al cambiar de hora se conserva el anillo: mitral II → coincide.
    await u.selectOptions(screen.getByLabelText(/^Hora en el anillo/), '2');
    expect(screen.getByTestId('concordancia-eef')).toHaveTextContent('Coincide');
    expect(screen.getByTestId('concordancia-eef')).toHaveTextContent('dentro de la región predicha');
    await u.click(screen.getByRole('radio', { name: 'Sitio de ablación exitosa' }));
    await u.click(screen.getByRole('button', { name: 'Guardar en el registro' }));
    await screen.findByTestId('registro-guardado');
    const [reg] = [...guardados.values()];
    expect(reg.eef).toEqual({
      localizacion: 'MV_2', anillo: 'MV', hora: 2, fuente: 'ablacion_exitosa', concordancia: 'concordante',
      distanciaHoras: 0, concordancias: { arruda: 'concordante' }, distancias: { arruda: 0 },
    });
    expect(reg.algoritmo).toBe('arruda');
    expect(reg.predicciones.arruda?.regiones).toEqual(['LL_LAL']);

    await u.click(screen.getByRole('button', { name: 'Analizar otro paciente' }));
    expect(screen.getByTestId('resumen-total')).toHaveTextContent('1 con resultado de EEF');
    expect(screen.getByText(/Coincidencia: 1 de 1 casos comparables \(100%\)/)).toBeInTheDocument();
    expect(screen.getByText('No hay análisis pendientes de EEF.')).toBeInTheDocument();
  });

  it('carga el EEF después, desde la lista de pendientes y buscando por código', async () => {
    const u = userEvent.setup();
    const { repo, guardados } = repositorioFalso();
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => repo} />);
    await analizarIzquierda(u, '5');
    await u.click(screen.getByRole('button', { name: 'Guardar en el registro' }));
    await screen.findByTestId('registro-guardado');
    const codigo = screen.getByTestId('codigo-registro').querySelector('span')!.textContent!;
    await u.click(screen.getByRole('button', { name: 'Analizar otro paciente' }));

    // Desde la lista de pendientes.
    await u.click(within(screen.getByTestId('tabla-pendientes')).getByRole('button', { name: 'Cargar EEF' }));
    await elegirSitio(u, 'TV', 9);
    await u.click(screen.getByRole('button', { name: 'Guardar resultado del EEF' }));
    expect(await screen.findByTestId('eef-guardado')).toBeInTheDocument();
    // Otro anillo: no coincide y no se mide la distancia en horas.
    expect(guardados.get(codigo)?.eef).toMatchObject({ localizacion: 'TV_9', anillo: 'TV', hora: 9, concordancia: 'discordante', distanciaHoras: null });
    await u.click(screen.getByRole('button', { name: 'Cerrar' }));

    // Corregirlo buscando por código (en minúsculas y sin guion).
    await u.type(screen.getByLabelText('Buscar por código'), codigo.replace('WPW-', 'wpw').toLowerCase());
    await u.click(screen.getByRole('button', { name: 'Buscar' }));
    const selector = await screen.findByLabelText('Localización confirmada en el estudio electrofisiológico');
    expect(selector).toHaveValue('TV');
    expect(screen.getByLabelText(/^Hora en el anillo/)).toHaveValue('9');
    await elegirSitio(u, 'MV', 1);
    await u.click(screen.getByRole('button', { name: 'Guardar resultado del EEF' }));
    await screen.findByTestId('eef-guardado');
    expect(guardados.get(codigo)?.eef).toMatchObject({ localizacion: 'MV_1', concordancia: 'concordante' });
  });

  it('avisa si el código no existe o es inválido', async () => {
    const u = userEvent.setup();
    const { repo } = repositorioFalso();
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => repo} />);
    await u.type(await screen.findByLabelText('Buscar por código'), 'hola');
    await u.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('WPW-XXXXXX');
    await u.clear(screen.getByLabelText('Buscar por código'));
    await u.type(screen.getByLabelText('Buscar por código'), 'WPW-222222');
    await u.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay ningún análisis con el código WPW-222222');
  });

  it('sin base de datos lo avisa y no ofrece guardar', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => null} />);
    await analizarIzquierda(u);
    expect(screen.getByTestId('registro-no-disponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar en el registro' })).not.toBeInTheDocument();
  });

  it('informa si no hay permiso para guardar', async () => {
    const u = userEvent.setup();
    const { repo } = repositorioFalso();
    repo.guardar = async () => Promise.reject({ code: 'invalid_argument' });
    render(<App obtenerLector={async () => null} obtenerRepositorio={async () => repo} />);
    await analizarIzquierda(u);
    await u.click(screen.getByRole('button', { name: 'Guardar en el registro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Colaborador');
  });
});
