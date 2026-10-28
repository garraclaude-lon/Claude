import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ENTRADA_VACIA } from '../algoritmo/arruda';
import { ModoImagen } from '../componentes/ModoImagen';
import type { LectorIA } from '../ia/lectorIA';
import type { ImagenPreparada } from '../imagen/preparar';

const archivo = new File(['x'], 'ecg.png', { type: 'image/png' });
async function llenarPaciente(u: ReturnType<typeof userEvent.setup>) {
  await u.click(await screen.findByRole('radio', { name: 'Masculino' }));
  await u.type(screen.getByLabelText('Años'), '0');
  await u.type(screen.getByLabelText('Meses'), '4');
  await u.click(screen.getByRole('button', { name: 'Continuar' }));
}

const preparar = async (f: File): Promise<ImagenPreparada> => ({ blob: f, url: 'blob:prueba', nombre: f.name });

describe('Modo imagen', () => {
  it('sin IA disponible permite revisar la imagen con el asistente', async () => {
    const u = userEvent.setup();
    const sinIA = async () => null;
    render(<ModoImagen onSalir={() => {}} obtenerLector={sinIA} preparar={preparar} />);
    await u.upload(screen.getByTestId('input-archivo'), archivo);
    expect(await screen.findByRole('img', { name: /ecg.png/ })).toBeInTheDocument();
    // Después de subir la imagen se piden sexo y edad.
    expect(screen.getByRole('heading', { name: 'Datos del paciente' })).toBeInTheDocument();
    await llenarPaciente(u);
    expect(screen.getByTestId('chip-paciente')).toHaveTextContent('Masculino · 4 meses · Lactante');
    expect(await screen.findByTestId('ia-no-disponible')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Revisar sin IA' }));
    expect(screen.getByTestId('pregunta')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /ecg.png/ })).toBeInTheDocument();
  });

  it('exige confirmar que no hay datos identificables antes de llamar a la IA', async () => {
    const u = userEvent.setup();
    const leer = vi.fn(async () => ({
      valores: { ...ENTRADA_VACIA, deltaI: 'negativa' as const },
      comentarios: {},
      calidad: 'regular' as const,
      esECG: true,
      observacionGeneral: 'Trazado algo borroso.',
    }));
    const lector: LectorIA = { leer };
    const conIA = async () => lector;
    render(<ModoImagen onSalir={() => {}} obtenerLector={conIA} preparar={preparar} />);
    await u.upload(screen.getByTestId('input-archivo'), archivo);
    await llenarPaciente(u);
    const boton = await screen.findByRole('button', { name: 'Pedir propuesta a la IA' });
    expect(boton).toBeDisabled();
    await u.click(screen.getByRole('checkbox', { name: /no contiene datos identificables/ }));
    await u.click(boton);
    await waitFor(() => expect(leer).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('pregunta')).toHaveTextContent('La IA sugiere: negativa');
    expect(screen.getByText(/Trazado algo borroso/)).toBeInTheDocument();
  });

  it('si la IA falla, muestra el error y deja seguir sin IA', async () => {
    const u = userEvent.setup();
    const lector: LectorIA = { leer: async () => Promise.reject({ code: 'rate_limited' }) };
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} />);
    await u.upload(screen.getByTestId('input-archivo'), archivo);
    await llenarPaciente(u);
    await u.click(await screen.findByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Pedir propuesta a la IA' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('límite de uso');
    expect(screen.getByRole('button', { name: 'Revisar sin IA' })).toBeEnabled();
  });

  it('informa un archivo que no se puede abrir', async () => {
    const u = userEvent.setup();
    const falla = async () => { throw new Error('Formato no admitido. Usá JPG, PNG, BMP o PDF.'); };
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => null} preparar={falla} />);
    await u.upload(screen.getByTestId('input-archivo'), archivo);
    expect(await screen.findByRole('alert')).toHaveTextContent('Formato no admitido');
  });
});
