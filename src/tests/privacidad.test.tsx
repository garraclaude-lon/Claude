import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ENTRADA_VACIA } from '../algoritmo/arruda';
import { ModoImagen } from '../componentes/ModoImagen';
import { interpretarDeteccion, PROMPT_PRIVACIDAD, type DeteccionPrivacidad, type LectorIA } from '../ia/lectorIA';
import { calcularRecorte, expandirCaja, normalizarCaja, type EditorImagen } from '../imagen/anonimizar';
import type { ImagenPreparada } from '../imagen/preparar';

describe('Geometría de anonimización', () => {
  it('expande la caja sin salirse de la imagen', () => {
    expect(expandirCaja({ x: 0.005, y: 0.5, ancho: 0.2, alto: 0.1 }, 0.01)).toEqual({ x: 0, y: 0.49, ancho: expect.closeTo(0.215, 5), alto: expect.closeTo(0.12, 5) });
    const borde = expandirCaja({ x: 0.9, y: 0.95, ancho: 0.1, alto: 0.05 });
    expect(borde.x + borde.ancho).toBeCloseTo(1);
    expect(borde.y + borde.alto).toBeCloseTo(1);
  });

  it('normaliza una caja dibujada en cualquier dirección', () => {
    expect(normalizarCaja(0.6, 0.4, 0.2, 0.1)).toEqual({ x: 0.2, y: 0.1, ancho: expect.closeTo(0.4, 5), alto: expect.closeTo(0.3, 5) });
    expect(normalizarCaja(-0.2, -1, 1.5, 0.5)).toEqual({ x: 0, y: 0, ancho: 1, alto: 0.5 });
  });

  it('recorta la franja superior cuando los datos están arriba', () => {
    const r = calcularRecorte([{ x: 0.05, y: 0.02, ancho: 0.3, alto: 0.05 }, { x: 0.6, y: 0.03, ancho: 0.2, alto: 0.04 }]);
    expect(r?.desde).toBeCloseTo(0.085);
    expect(r?.hasta).toBe(1);
  });

  it('recorta abajo, o arriba y abajo a la vez', () => {
    expect(calcularRecorte([{ x: 0, y: 0.9, ancho: 0.5, alto: 0.05 }])).toEqual({ desde: 0, hasta: expect.closeTo(0.885, 5) });
    const ambos = calcularRecorte([{ x: 0, y: 0.01, ancho: 0.5, alto: 0.05 }, { x: 0, y: 0.92, ancho: 0.4, alto: 0.05 }]);
    expect(ambos!.desde).toBeCloseTo(0.075);
    expect(ambos!.hasta).toBeCloseTo(0.905);
  });

  it('no recorta si un dato está en medio del trazado o si se perdería demasiado', () => {
    expect(calcularRecorte([{ x: 0.4, y: 0.45, ancho: 0.2, alto: 0.05 }])).toBeNull();
    expect(calcularRecorte([{ x: 0, y: 0.0, ancho: 1, alto: 0.33 }, { x: 0, y: 0.7, ancho: 1, alto: 0.05 }])).toBeNull();
    expect(calcularRecorte([])).toBeNull();
  });
});

describe('interpretarDeteccion', () => {
  it('acepta zonas válidas, limita coordenadas y tipos desconocidos pasan a "otro"', () => {
    const d = interpretarDeteccion({
      hayDatosPersonales: true,
      zonas: [
        { tipo: 'nombre', x: 0.05, y: 0.02, ancho: 0.3, alto: 0.04 },
        { tipo: 'cosa', x: 0.9, y: 0.9, ancho: 0.5, alto: 0.5 },
        { tipo: 'documento', x: 'a', y: 0, ancho: 1, alto: 1 },
        { tipo: 'documento', x: 0.1, y: 0.1, ancho: 0, alto: 0.1 },
        null,
      ],
    });
    expect(d.hayDatosPersonales).toBe(true);
    expect(d.zonas).toHaveLength(2);
    expect(d.zonas[1]).toMatchObject({ tipo: 'otro', x: 0.9, y: 0.9 });
    expect(d.zonas[1].x + d.zonas[1].ancho).toBeCloseTo(1);
  });

  it('respuesta vacía o inválida → sin datos', () => {
    expect(interpretarDeteccion({ hayDatosPersonales: false, zonas: [] })).toEqual({ hayDatosPersonales: false, zonas: [] });
    expect(interpretarDeteccion('texto')).toEqual({ hayDatosPersonales: false, zonas: [] });
  });

  it('el pedido a la IA prohíbe transcribir los datos', () => {
    expect(PROMPT_PRIVACIDAD).toContain('NO transcribas');
  });
});

// --- Flujo en pantalla --------------------------------------------------------

const archivo = new File(['x'], 'Perez_Juan.png', { type: 'image/png' });
const preparar = async (f: File): Promise<ImagenPreparada> => ({ blob: f, url: 'blob:original', nombre: f.name });
const anonima = new Blob(['anon'], { type: 'image/jpeg' });

function editorFalso(): EditorImagen & { ocultar: ReturnType<typeof vi.fn>; recortar: ReturnType<typeof vi.fn> } {
  return { ocultar: vi.fn(async () => anonima), recortar: vi.fn(async () => anonima) };
}

function lectorCon(deteccion: DeteccionPrivacidad | (() => Promise<DeteccionPrivacidad>)) {
  const leer = vi.fn(async () => ({ valores: { ...ENTRADA_VACIA }, comentarios: {}, calidad: null, esECG: true, observacionGeneral: '' }));
  const detectarDatosPersonales = vi.fn(typeof deteccion === 'function' ? deteccion : async () => deteccion);
  const lector: LectorIA = { leer, detectarDatosPersonales };
  return { lector, leer, detectarDatosPersonales };
}

/** A partir de la próxima llamada, la revisión responde en este orden (true = hay datos). */
function detectarSecuencia(lector: LectorIA, hay: boolean[]) {
  const f = lector.detectarDatosPersonales as ReturnType<typeof vi.fn>;
  const original = f.getMockImplementation();
  let llamada = 0;
  f.mockImplementation(async (...args: unknown[]) => {
    llamada++;
    if (llamada === 1 && original) return original(...args);
    const h = hay[Math.min(llamada - 2, hay.length - 1)];
    return { hayDatosPersonales: h, zonas: h ? [{ tipo: 'nombre', x: 0, y: 0, ancho: 0.2, alto: 0.05 }] : [] };
  });
}

async function subir(u: ReturnType<typeof userEvent.setup>) {
  await u.upload(screen.getByTestId('input-archivo'), archivo);
}

describe('Datos personales en la imagen', () => {
  it('si detecta un nombre arriba, muestra la alerta roja y recorta la imagen', async () => {
    const u = userEvent.setup();
    const editor = editorFalso();
    const { lector, leer } = lectorCon({ hayDatosPersonales: true, zonas: [{ tipo: 'nombre', x: 0.05, y: 0.02, ancho: 0.3, alto: 0.04 }, { tipo: 'documento', x: 0.5, y: 0.02, ancho: 0.2, alto: 0.04 }] });
    // Después de recortar, la nueva revisión ya no encuentra datos.
    detectarSecuencia(lector, [false]);
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editor} />);
    await subir(u);

    const alerta = await screen.findByRole('alertdialog');
    expect(alerta).toHaveTextContent('Se detectaron datos personales en la imagen');
    expect(within(alerta).getByText('Nombre')).toBeInTheDocument();
    expect(within(alerta).getByText('Número de documento')).toBeInTheDocument();
    expect(alerta).toHaveTextContent('recortar la imagen');
    // Nunca muestra el dato en sí (no lo recibe).
    expect(alerta).not.toHaveTextContent('Perez');

    await u.click(within(alerta).getByRole('button', { name: 'Recortar y continuar' }));
    expect(editor.recortar).toHaveBeenCalledWith(archivo, { desde: expect.any(Number), hasta: 1 });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('estado-privacidad')).toHaveTextContent('Imagen anonimizada: se recortó la franja');
    // El nombre del archivo (que puede tener el nombre del paciente) deja de mostrarse.
    expect(screen.getByRole('img', { name: /ECG anonimizado/ })).toBeInTheDocument();
    expect(screen.queryByText(/Perez_Juan/)).not.toBeInTheDocument();

    // La lectura del ECG con IA recibe la imagen anonimizada, no la original.
    await u.click(screen.getByRole('radio', { name: 'Masculino' }));
    await u.type(screen.getByLabelText('Años'), '5');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await u.click(screen.getByRole('button', { name: 'Localizar vía con IA' }));
    await waitFor(() => expect(leer).toHaveBeenCalledWith(anonima, expect.anything()));
    // La revisión de control se hizo sobre la imagen anonimizada.
    expect(lector.detectarDatosPersonales).toHaveBeenLastCalledWith(anonima, expect.anything());
  });

  it('si el dato está en medio del trazado, oculta la zona en lugar de recortar', async () => {
    const u = userEvent.setup();
    const editor = editorFalso();
    const zonas = [{ tipo: 'historia_clinica' as const, x: 0.4, y: 0.5, ancho: 0.2, alto: 0.05 }];
    const { lector } = lectorCon({ hayDatosPersonales: true, zonas });
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editor} />);
    await subir(u);
    const alerta = await screen.findByRole('alertdialog');
    expect(alerta).toHaveTextContent('ocultar esas zonas');
    expect(within(alerta).queryByRole('button', { name: /Recortar/ })).not.toBeInTheDocument();
    await u.click(within(alerta).getByRole('button', { name: 'Ocultar y continuar' }));
    expect(editor.ocultar).toHaveBeenCalledWith(archivo, zonas);
    expect(await screen.findByTestId('estado-privacidad')).toHaveTextContent('se ocultó 1 zona');
  });

  it('permite elegir ocultar aunque se recomiende recortar', async () => {
    const u = userEvent.setup();
    const editor = editorFalso();
    const { lector } = lectorCon({ hayDatosPersonales: true, zonas: [{ tipo: 'nombre', x: 0, y: 0.9, ancho: 0.4, alto: 0.05 }] });
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editor} />);
    await subir(u);
    await u.click(await screen.findByRole('button', { name: 'Ocultar zonas en lugar de recortar' }));
    expect(editor.ocultar).toHaveBeenCalled();
    expect(editor.recortar).not.toHaveBeenCalled();
  });

  it('sin datos personales no muestra alerta', async () => {
    const u = userEvent.setup();
    const { lector } = lectorCon({ hayDatosPersonales: false, zonas: [] });
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editorFalso()} />);
    await subir(u);
    expect(await screen.findByText('No se detectaron datos personales en la imagen.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('si la revisión falla, avisa que hay que revisar a mano', async () => {
    const u = userEvent.setup();
    const { lector } = lectorCon(() => Promise.reject({ code: 'upstream_error' }));
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editorFalso()} />);
    await subir(u);
    expect(await screen.findByTestId('estado-privacidad')).toHaveTextContent('No se pudo confirmar automáticamente');
    expect(screen.getByRole('button', { name: 'Tapar una zona a mano' })).toBeInTheDocument();
  });

  it('la lectura con IA espera a que termine la revisión de privacidad', async () => {
    const u = userEvent.setup();
    let terminar: (d: DeteccionPrivacidad) => void = () => {};
    const { lector } = lectorCon(() => new Promise((ok) => (terminar = ok)));
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editorFalso()} />);
    await subir(u);
    expect(await screen.findByText(/Revisando si la imagen muestra datos personales/)).toBeInTheDocument();
    await u.click(screen.getByRole('radio', { name: 'Femenino' }));
    await u.type(screen.getByLabelText('Años'), '2');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('button', { name: 'Revisando la imagen…' })).toBeDisabled();
    terminar({ hayDatosPersonales: false, zonas: [] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Localizar vía con IA' })).toBeEnabled());
  });

  it('si al seguir todavía detecta datos personales, no avanza y muestra el aviso', async () => {
    const u = userEvent.setup();
    const { lector, leer } = lectorCon(() => Promise.reject({ code: 'upstream_error' }));
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editorFalso()} />);
    await subir(u);
    expect(await screen.findByTestId('estado-privacidad')).toHaveTextContent('No se pudo confirmar automáticamente');
    // La segunda revisión (al querer seguir) encuentra un nombre.
    (lector.detectarDatosPersonales as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ hayDatosPersonales: true, zonas: [{ tipo: 'nombre', x: 0, y: 0, ancho: 0.2, alto: 0.05 }] }));
    await u.click(screen.getByRole('radio', { name: 'Femenino' }));
    await u.type(screen.getByLabelText('Años'), '3');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));

    await u.click(screen.getByRole('button', { name: 'Localizar vía con IA' }));
    const aviso = await screen.findByTestId('bloqueo-datos');
    expect(within(aviso).getByRole('alertdialog')).toHaveTextContent('No puedo continuar porque contiene datos personales del paciente.');
    expect(leer).not.toHaveBeenCalled();
    await u.click(within(aviso).getByRole('button', { name: 'Cerrar' }));

    // Insistir vuelve a frenar.
    await u.click(screen.getByRole('button', { name: 'Localizar vía con IA' }));
    const aviso2 = await screen.findByTestId('bloqueo-datos');
    expect(screen.queryByTestId('pregunta')).not.toBeInTheDocument();
    // Desde el aviso se puede ir directo a tapar a mano.
    await u.click(within(aviso2).getByRole('button', { name: 'Tapar una zona a mano' }));
    expect(screen.queryByTestId('bloqueo-datos')).not.toBeInTheDocument();
  });

  it('al seguir solo frena por nombre o apellido, no por otros datos', async () => {
    const u = userEvent.setup();
    const { lector } = lectorCon(() => Promise.reject({ code: 'upstream_error' }));
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editorFalso()} />);
    await subir(u);
    await screen.findByText(/No se pudo confirmar automáticamente/);
    (lector.detectarDatosPersonales as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ hayDatosPersonales: true, zonas: [{ tipo: 'documento', x: 0, y: 0, ancho: 0.2, alto: 0.05 }] }));
    await u.click(screen.getByRole('radio', { name: 'Masculino' }));
    await u.type(screen.getByLabelText('Años'), '4');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await u.click(screen.getByRole('button', { name: 'Localizar vía con IA' }));
    expect(await screen.findByTestId('pregunta')).toBeInTheDocument();
    expect(screen.queryByTestId('bloqueo-datos')).not.toBeInTheDocument();
  });

  it('si la imagen ya dio limpia, avanza sin volver a revisarla', async () => {
    const u = userEvent.setup();
    const { lector, detectarDatosPersonales } = lectorCon({ hayDatosPersonales: false, zonas: [] });
    render(<ModoImagen onSalir={() => {}} obtenerLector={async () => lector} preparar={preparar} editor={editorFalso()} />);
    await subir(u);
    await screen.findByText('No se detectaron datos personales en la imagen.');
    await u.click(screen.getByRole('radio', { name: 'Masculino' }));
    await u.type(screen.getByLabelText('Años'), '1');
    await u.click(screen.getByRole('button', { name: 'Continuar' }));
    await u.click(screen.getByRole('button', { name: 'Localizar vía con IA' }));
    expect(await screen.findByTestId('pregunta')).toBeInTheDocument();
    expect(detectarDatosPersonales).toHaveBeenCalledTimes(1);
  });
});
