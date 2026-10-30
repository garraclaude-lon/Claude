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

describe('Asistente con EASY-WPW como principal y Arruda como comparación', () => {
  it('pregunta primero EASY-WPW, después Arruda, y muestra los dos resultados', async () => {
    const u = userEvent.setup();
    let comparacion: string | undefined;
    render(
      <Asistente
        modo="easy_y_arruda"
        onSalir={() => {}}
        alTerminar={({ resultado, comparacion: c }) => {
          comparacion = `${resultado.algoritmo}:${resultado.regiones.map((r) => r.codigo)}|${c?.algoritmo}:${c?.regiones.map((r) => r.codigo)}`;
          return null;
        }}
      />,
    );
    // EASY-WPW: V1 negativa → transición hasta V3 → delta más positiva en aVL → PST
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Algoritmo principal: EASY-WPW');
    expect(pregunta()).toHaveTextContent('polaridad (+ o -) del QRS en V1');
    await responder(u, 'Negativa');
    expect(pregunta()).toHaveTextContent('transición del QRS');
    await responder(u, 'Hasta V3');
    expect(pregunta()).toHaveTextContent('onda Delta es más positiva');
    await responder(u, 'aVL');

    // Arruda sobre el mismo ECG: I positiva, R ≤ S en V1, II positiva, V1 negativa, aVF negativa → PST/OSC
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Comparación: Arruda');
    await responder(u, 'Positiva');
    await responder(u, 'R ≤ S');
    await responder(u, 'Positiva');
    await responder(u, 'Negativa');
    await responder(u, 'Negativa');

    const principal = screen.getByTestId('panel-resultado');
    expect(within(principal).getByRole('heading', { level: 2 })).toHaveTextContent('Resultado — EASY-WPW');
    expect(within(principal).getByTestId('region')).toHaveTextContent('PST');
    const comp = screen.getByTestId('comparacion-arruda');
    expect(comp).toHaveTextContent('PST/OSC');
    // PST (EASY-WPW) y PST/OSC (Arruda) corresponden al mismo sitio posteroseptal tricuspídeo
    expect(comp).toHaveTextContent('Los dos algoritmos señalan la misma zona');
    expect(comparacion).toBe('easy_wpw:PSTA|arruda:PSTA_CSOS');
  });

  it('“Atrás” vuelve de Arruda a la última pregunta de EASY-WPW', async () => {
    const u = userEvent.setup();
    render(<Asistente modo="easy_y_arruda" onSalir={() => {}} />);
    await responder(u, 'Positiva'); // V1
    await responder(u, 'III'); // EASY completo: IL/IAL
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Comparación: Arruda');
    await u.click(screen.getByRole('button', { name: '← Atrás' }));
    expect(screen.getByTestId('fase-algoritmo')).toHaveTextContent('Algoritmo principal: EASY-WPW');
    expect(pregunta()).toHaveTextContent('onda Delta es más positiva');
  });
});
