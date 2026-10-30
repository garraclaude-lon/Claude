import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ENTRADA_VACIA } from '../algoritmo/arruda';
import { Asistente } from '../componentes/Asistente';
import type { PropuestaIA } from '../ia/lectorIA';

type Usuario = ReturnType<typeof userEvent.setup>;

const pregunta = () => screen.getByTestId('pregunta');
const responder = (u: Usuario, opcion: string) => {
  const boton = within(pregunta())
    .getAllByRole('button')
    .find((b) => b.textContent?.replace('Sugerida por IA', '') === opcion);
  if (!boton) throw new Error(`No hay opción "${opcion}"`);
  return u.click(boton);
};

describe('Asistente guiado', () => {
  it('solo pregunta lo que la rama necesita (I negativa → aVF, sin R/S en V1)', async () => {
    const u = userEvent.setup();
    render(<Asistente onSalir={() => {}} />);
    expect(pregunta()).toHaveTextContent('DI¿Cómo es la polaridad (+ o -) de la onda Delta?');
    await responder(u, 'Negativa');
    expect(pregunta()).toHaveTextContent('aVF¿Cómo es la polaridad (+ o -) de la onda Delta?');
    await responder(u, 'Positiva');
    expect(screen.queryByTestId('pregunta')).not.toBeInTheDocument();
    expect(screen.getByTestId('region')).toHaveTextContent('IL/IAL');
    expect(screen.getByTestId('ruta')).toHaveTextContent('IL/IAL');
  });

  it('recorre los cuatro pasos hasta DL', async () => {
    const u = userEvent.setup();
    render(<Asistente onSalir={() => {}} />);
    await responder(u, 'Positiva'); // I
    expect(pregunta()).toHaveTextContent('R respecto de la onda S en V1');
    await responder(u, 'R ≤ S'); // R/S V1
    expect(pregunta()).toHaveTextContent('II¿Cómo es la polaridad (+ o -) de la onda Delta?');
    await responder(u, 'Positiva'); // II
    expect(pregunta()).toHaveTextContent('V1¿Cómo es la polaridad (+ o -) de la onda Delta?');
    await responder(u, 'Positiva'); // V1
    expect(pregunta()).toHaveTextContent('aVR¿Cómo es la polaridad (+ o -) de la onda Delta?');
    await responder(u, 'Negativa'); // aVR → usa II ya respondida
    expect(screen.getByTestId('region')).toHaveTextContent('DL');
    expect(screen.getByTestId('ruta').querySelectorAll('li')).toHaveLength(4);
  });

  it('“Atrás” deshace la última respuesta', async () => {
    const u = userEvent.setup();
    render(<Asistente onSalir={() => {}} />);
    await responder(u, 'Negativa');
    expect(pregunta()).toHaveTextContent('aVF');
    await u.click(screen.getByRole('button', { name: '← Atrás' }));
    expect(pregunta()).toHaveTextContent('DI¿Cómo es la polaridad (+ o -) de la onda Delta?');
  });

  it('un criterio no evaluable termina como indeterminado sin inventar región', async () => {
    const u = userEvent.setup();
    render(<Asistente onSalir={() => {}} />);
    await responder(u, 'Negativa');
    await responder(u, 'No evaluable');
    expect(screen.getByTestId('estado')).toHaveTextContent('Resultado indeterminado');
    expect(screen.queryAllByTestId('region')).toHaveLength(0);
  });

  it('las sugerencias de la IA no se aplican sin confirmación', async () => {
    const u = userEvent.setup();
    const propuesta: PropuestaIA = {
      valores: { ...ENTRADA_VACIA, deltaI: 'negativa', deltaAVF: 'positiva' },
      comentarios: { deltaI: 'Deflexión inicial negativa.' },
      calidad: 'buena',
      esECG: true,
      observacionGeneral: '',
    };
    render(<Asistente onSalir={() => {}} propuesta={propuesta} />);
    // Con todas las sugerencias disponibles, igual se muestra la primera pregunta.
    expect(pregunta()).toHaveTextContent('DI¿Cómo es la polaridad (+ o -) de la onda Delta?');
    expect(pregunta()).toHaveTextContent('La IA sugiere: negativa');
    expect(within(pregunta()).getByRole('button', { name: /Negativa.*Sugerida por IA/ })).toBeInTheDocument();
    // El profesional elige distinto de la IA.
    await responder(u, 'Isoeléctrica');
    await responder(u, 'Negativa'); // aVF
    expect(screen.getByTestId('region')).toHaveTextContent('IP/IPL');
    const tabla = screen.getByRole('heading', { name: /Propuesta de la IA frente/ }).parentElement!;
    expect(tabla).toHaveTextContent('Coincidencia en 0 de 2');
  });
});

describe('Asistente con SMART-WPW como principal, EASY-WPW y Arruda como comparación', () => {
  it('pregunta SMART-WPW, después EASY-WPW y Arruda, sin repetir datos, y muestra los tres', async () => {
    const u = userEvent.setup();
    let guardado: string | undefined;
    render(
      <Asistente
        modo="smart_easy_arruda"
        onSalir={() => {}}
        alTerminar={({ resultado, comparaciones }) => {
          guardado = [resultado, ...(comparaciones ?? [])].map((r) => `${r.algoritmo}:${r.regiones.map((x) => x.codigo)}`).join('|');
          return null;
        }}
      />,
    );
    // SMART-WPW: delta V1 negativa → V3 positiva (septal) → III, aVF y II negativas → PS (V)
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Algoritmo principal: SMART-WPW');
    expect(pregunta()).toHaveTextContent('V1');
    await responder(u, 'Negativa');
    expect(pregunta()).toHaveTextContent('polaridad (+ o -) del QRS en V3');
    await responder(u, 'Positiva');
    await responder(u, 'Negativa'); // III
    await responder(u, 'Negativa'); // aVF
    await responder(u, 'Negativa'); // II

    // EASY-WPW sobre el mismo ECG
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Comparación: EASY-WPW');
    await responder(u, 'Negativa'); // QRS en V1
    await responder(u, 'Hasta V3');
    await responder(u, 'aVL');

    // Arruda: solo pide lo que falta (II ya está: negativa → PS subepicárdica)
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Comparación: Arruda');
    await responder(u, 'Positiva'); // delta I
    await responder(u, 'R ≤ S');

    const principal = screen.getByTestId('panel-resultado');
    expect(within(principal).getByRole('heading', { level: 2 })).toHaveTextContent('Resultado — SMART-WPW');
    expect(within(principal).getByTestId('sector-horario')).toHaveTextContent('Tricuspídeo V (posteroseptal)');
    expect(within(principal).getByTestId('dg-sector')).toBeInTheDocument();
    expect(screen.getByTestId('comparacion-easy_wpw')).toHaveTextContent('Sí');
    expect(screen.getByTestId('comparacion-arruda')).toHaveTextContent('PS subepicárdica');
    expect(screen.getByTestId('comparacion-arruda')).toHaveTextContent('No');
    expect(guardado).toBe('smart_wpw:PSTA|easy_wpw:PSTA|arruda:PS_SUBEPI');
  });

  it('“Atrás” vuelve de la comparación a la última pregunta de SMART-WPW', async () => {
    const u = userEvent.setup();
    render(<Asistente modo="smart_easy_arruda" onSalir={() => {}} />);
    await responder(u, 'Positiva'); // delta V1 → mitral
    await responder(u, 'Positiva'); // III
    await responder(u, 'Positiva'); // aVF
    await responder(u, 'Positiva'); // II → L (I–III)
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Comparación: EASY-WPW');
    await u.click(screen.getByRole('button', { name: '← Atrás' }));
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Algoritmo principal: SMART-WPW');
    expect(pregunta()).toHaveTextContent('II');
  });
});
