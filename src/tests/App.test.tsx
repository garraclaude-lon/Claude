import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

type Usuario = ReturnType<typeof userEvent.setup>;

async function elegir(usuario: Usuario, campo: string, opcion: string) {
  const grupo = screen.getByRole('group', { name: campo });
  await usuario.click(within(grupo).getByRole('radio', { name: opcion }));
}

async function llenarPaciente(u: Usuario, sexo = 'Femenino', anios = '7', meses = '6') {
  await u.click(screen.getByRole('radio', { name: sexo }));
  await u.type(screen.getByLabelText('Años'), anios);
  if (meses) await u.type(screen.getByLabelText('Meses'), meses);
  await u.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function abrirFormulario(u: Usuario) {
  await u.click(screen.getByRole('button', { name: /Cuestionario guiado/ }));
  await llenarPaciente(u);
  await u.click(screen.getByRole('button', { name: 'Usar el formulario completo' }));
}

// Sin IA: el modo imagen no la necesita para estas pruebas.
const sinIA = async () => null;

describe('Pantalla de inicio', () => {
  it('muestra encabezado, pie y las dos versiones', () => {
    render(<App obtenerLector={sinIA} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WPW Navigator 3D by Longa');
    expect(screen.getByText('Localización de vías accesorias — Algoritmo de Arruda')).toBeInTheDocument();
    expect(screen.queryByText(/Prototipo de investigación\./)).not.toBeInTheDocument();
    expect(screen.getByText(/Prototipo sin uso asistencial/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subir ECG/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cuestionario guiado/ })).toBeInTheDocument();
  });

  it('el cuestionario guiado pide primero sexo y edad, y después la onda delta en I', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={sinIA} />);
    await u.click(screen.getByRole('button', { name: /Cuestionario guiado/ }));
    expect(screen.getByRole('heading', { name: 'Datos del paciente' })).toBeInTheDocument();
    await llenarPaciente(u);
    expect(screen.getByTestId('chip-paciente')).toHaveTextContent('Femenino · 7 a 6 m · Escolar');
    expect(screen.getByTestId('pregunta')).toHaveTextContent('DI¿Cómo es la polaridad (+ o -) de la onda Delta?');
  });

  it('no avanza sin sexo y edad válidos', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={sinIA} />);
    await u.click(screen.getByRole('button', { name: /Cuestionario guiado/ }));
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText('Elegí una opción.')).toBeInTheDocument();
    expect(screen.queryByTestId('pregunta')).not.toBeInTheDocument();
    await llenarPaciente(u, 'Masculino', '3', '14');
    expect(screen.getByText('Los meses van de 0 a 11.')).toBeInTheDocument();
    expect(screen.queryByTestId('pregunta')).not.toBeInTheDocument();
  });

  it('el formulario completo conserva los datos del paciente', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={sinIA} />);
    await abrirFormulario(u);
    expect(screen.getByTestId('chip-paciente')).toHaveTextContent('Femenino');
    expect(screen.getByRole('button', { name: 'Calcular localización' })).toBeInTheDocument();
  });

  it('la versión simple ofrece cámara y carga de archivo', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={sinIA} />);
    await u.click(screen.getByRole('button', { name: /Subir ECG/ }));
    expect(screen.getByTestId('input-camara')).toHaveAttribute('capture', 'environment');
    expect(screen.getByTestId('input-archivo').getAttribute('accept')).toContain('.bmp');
    expect(screen.getByTestId('input-archivo').getAttribute('accept')).toContain('.pdf');
  });

  it('volver al inicio desde cada modo', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={sinIA} />);
    await u.click(screen.getByRole('button', { name: /Subir ECG/ }));
    await u.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    expect(screen.getByRole('region', { name: 'Modo de trabajo' })).toBeInTheDocument();
    expect(screen.queryByText('¿Cómo querés trabajar?')).not.toBeInTheDocument();
  });
});

describe('Formulario completo', () => {
  it('calcula IL/IAL y la ruta mostrada coincide con el resultado', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={sinIA} />);
    await abrirFormulario(u);
    await elegir(u, 'Onda delta en I', 'Negativa');
    await elegir(u, 'Onda delta en aVF', 'Positiva');
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));

    const panel = screen.getByTestId('panel-resultado');
    expect(within(panel).getByTestId('estado')).toHaveTextContent('Región predicha');
    const regiones = within(panel).getAllByTestId('region');
    expect(regiones).toHaveLength(1);
    expect(regiones[0]).toHaveTextContent('IL/IAL');
    const ruta = within(panel).getByTestId('ruta');
    expect(within(ruta).getAllByRole('listitem')).toHaveLength(1);
    expect(ruta).toHaveTextContent('IL/IAL');
    expect(panel).toHaveTextContent('No es una localización confirmada');
    expect(panel).toHaveTextContent('J Cardiovasc Electrophysiol');
    expect(panel).toHaveTextContent('arruda-1998-impl-0.1.0');
  });

  it('con el formulario vacío pide los datos faltantes del paso 1', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={sinIA} />);
    await abrirFormulario(u);
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
    render(<App obtenerLector={sinIA} />);
    await abrirFormulario(u);
    await elegir(u, 'Onda delta en I', 'Negativa');
    await elegir(u, 'Onda delta en aVF', 'Positiva');
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));
    await elegir(u, 'Onda delta en aVF', 'Negativa');
    expect(screen.getByText(/Modificaste los datos/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));
    expect(screen.queryByText(/Modificaste los datos/)).not.toBeInTheDocument();
    expect(screen.getByTestId('region')).toHaveTextContent('IP/IPL');
  });

  it('reiniciar limpia el formulario y el resultado', async () => {
    const u = userEvent.setup();
    render(<App obtenerLector={sinIA} />);
    await abrirFormulario(u);
    await elegir(u, 'Onda delta en I', 'Negativa');
    await u.click(screen.getByRole('button', { name: 'Calcular localización' }));
    await u.click(screen.getByRole('button', { name: 'Reiniciar formulario' }));
    expect(screen.queryByTestId('panel-resultado')).not.toBeInTheDocument();
    const grupo = screen.getByRole('group', { name: 'Onda delta en I' });
    within(grupo).getAllByRole('radio').forEach((r) => expect(r).not.toBeChecked());
  });
});
