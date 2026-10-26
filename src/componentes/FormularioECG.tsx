import type { CampoECG, EntradaECG } from '../algoritmo/tipos';

interface Opcion {
  valor: string;
  etiqueta: string;
}

interface DefCampo {
  campo: CampoECG;
  etiqueta: string;
  ayuda: string;
  opciones: Opcion[];
}

interface DefDerivacion {
  derivacion: string;
  campos: DefCampo[];
}

const OPCIONES_POLARIDAD: Opcion[] = [
  { valor: 'positiva', etiqueta: 'Positiva' },
  { valor: 'negativa', etiqueta: 'Negativa' },
  { valor: 'isoelectrica', etiqueta: 'Isoeléctrica' },
  { valor: 'no_evaluable', etiqueta: 'No evaluable' },
];

const AYUDA_DELTA = 'Polaridad inicial de la onda delta (primeros 20 ms).';

/** Formulario ordenado por derivación: I, II, III, aVR, aVF, V1. */
export const DERIVACIONES: DefDerivacion[] = [
  {
    derivacion: 'I',
    campos: [{ campo: 'deltaI', etiqueta: 'Onda delta en I', ayuda: AYUDA_DELTA, opciones: OPCIONES_POLARIDAD }],
  },
  {
    derivacion: 'II',
    campos: [{ campo: 'deltaII', etiqueta: 'Onda delta en II', ayuda: AYUDA_DELTA, opciones: OPCIONES_POLARIDAD }],
  },
  {
    derivacion: 'III',
    campos: [
      {
        campo: 'rsIII',
        etiqueta: 'Relación R/S en III',
        ayuda: 'Amplitud de la onda R comparada con la onda S del QRS en III.',
        opciones: [
          { valor: 'r_mayor_s', etiqueta: 'R > S' },
          { valor: 'r_menor_s', etiqueta: 'R < S' },
          { valor: 'iguales', etiqueta: 'R = S' },
          { valor: 'no_evaluable', etiqueta: 'No evaluable' },
        ],
      },
    ],
  },
  {
    derivacion: 'aVR',
    campos: [{ campo: 'deltaAVR', etiqueta: 'Onda delta en aVR', ayuda: AYUDA_DELTA, opciones: OPCIONES_POLARIDAD }],
  },
  {
    derivacion: 'aVF',
    campos: [{ campo: 'deltaAVF', etiqueta: 'Onda delta en aVF', ayuda: AYUDA_DELTA, opciones: OPCIONES_POLARIDAD }],
  },
  {
    derivacion: 'V1',
    campos: [
      { campo: 'deltaV1', etiqueta: 'Onda delta en V1', ayuda: AYUDA_DELTA, opciones: OPCIONES_POLARIDAD },
      {
        campo: 'rsV1',
        etiqueta: 'Relación R/S en V1',
        ayuda: 'Amplitud de la onda R comparada con la onda S del QRS en V1.',
        opciones: [
          { valor: 'r_mayor_s', etiqueta: 'R > S' },
          { valor: 'r_menor_igual_s', etiqueta: 'R ≤ S' },
          { valor: 'no_evaluable', etiqueta: 'No evaluable' },
        ],
      },
    ],
  },
];

interface Props {
  entrada: EntradaECG;
  faltantes: CampoECG[];
  onCambio: (campo: CampoECG, valor: string | null) => void;
  onCalcular: () => void;
  onReiniciar: () => void;
}

export function FormularioECG({ entrada, faltantes, onCambio, onCalcular, onReiniciar }: Props) {
  return (
    <form
      className="formulario"
      aria-labelledby="titulo-formulario"
      onSubmit={(ev) => {
        ev.preventDefault();
        onCalcular();
      }}
    >
      <h2 id="titulo-formulario">Criterios electrocardiográficos</h2>
      <div className="nota-medicion" role="note">
        <strong>Cómo medir la onda delta:</strong> evaluá la polaridad de los{' '}
        <strong>primeros 20 ms</strong> desde su inicio más temprano identificable (en cualquier
        derivación). Una onda que <strong>comienza isoeléctrica y luego se negativiza no debe
        marcarse como negativa</strong>. Si no podés evaluarla con seguridad, elegí “No evaluable”.
      </div>

      {DERIVACIONES.map((d) => (
        <section key={d.derivacion} className="derivacion" aria-label={`Derivación ${d.derivacion}`}>
          <h3 className="derivacion-nombre">{d.derivacion}</h3>
          <div className="derivacion-campos">
            {d.campos.map((c) => {
              const valor = entrada[c.campo];
              const falta = faltantes.includes(c.campo);
              const idAyuda = `ayuda-${c.campo}`;
              return (
                <fieldset
                  key={c.campo}
                  className={`campo${falta ? ' campo-faltante' : ''}`}
                  aria-describedby={idAyuda}
                  aria-invalid={falta || undefined}
                >
                  <legend>{c.etiqueta}</legend>
                  <p id={idAyuda} className="ayuda">
                    {c.ayuda}
                    {falta && <span className="aviso-faltante"> Dato necesario para continuar.</span>}
                  </p>
                  <div className="opciones">
                    {c.opciones.map((o) => (
                      <label key={o.valor} className={`opcion${valor === o.valor ? ' seleccionada' : ''}`}>
                        <input
                          type="radio"
                          name={c.campo}
                          value={o.valor}
                          checked={valor === o.valor}
                          onChange={() => onCambio(c.campo, o.valor)}
                        />
                        {o.etiqueta}
                      </label>
                    ))}
                    {valor !== null && (
                      <button
                        type="button"
                        className="boton-limpiar"
                        onClick={() => onCambio(c.campo, null)}
                        aria-label={`Borrar ${c.etiqueta}`}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </section>
      ))}

      <div className="acciones">
        <button type="submit" className="boton-primario">
          Calcular localización
        </button>
        <button type="button" className="boton-secundario" onClick={onReiniciar}>
          Reiniciar formulario
        </button>
      </div>
    </form>
  );
}
