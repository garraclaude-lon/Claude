import {
  LOCALIZACIONES_EEF,
  NOMBRES_CONCORDANCIA,
  NOMBRES_FUENTE,
  POR_CODIGO_EEF,
  type CodigoEEF,
  type Concordancia,
  type FuenteEEF,
} from '../registro/eef';

interface Props {
  id: string;
  valor: CodigoEEF | null;
  fuente: FuenteEEF | null;
  onCambiar: (v: CodigoEEF | null) => void;
  onCambiarFuente: (v: FuenteEEF | null) => void;
  concordancia: Concordancia | null;
  textoPendiente: string;
}

const GRUPOS = [...new Set(LOCALIZACIONES_EEF.map((l) => l.grupo))];

/** Elegir la localización confirmada en el EEF (lista cerrada, sin texto libre). */
export function SelectorEEF({ id, valor, fuente, onCambiar, onCambiarFuente, concordancia, textoPendiente }: Props) {
  const conSitio = valor !== null && POR_CODIGO_EEF[valor].compatibles.length > 0;
  return (
    <div className="selector-eef">
      <label htmlFor={id} className="selector-eef-etiqueta">
        Localización confirmada en el estudio electrofisiológico
      </label>
      <select
        id={id}
        value={valor ?? ''}
        onChange={(e) => {
          const v = (e.target.value || null) as CodigoEEF | null;
          onCambiar(v);
          if (!v || POR_CODIGO_EEF[v].compatibles.length === 0) onCambiarFuente(null);
        }}
      >
        <option value="">{textoPendiente}</option>
        {GRUPOS.map((g) => (
          <optgroup key={g} label={g}>
            {LOCALIZACIONES_EEF.filter((l) => l.grupo === g).map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {conSitio && (
        <fieldset className="campo selector-eef-fuente">
          <legend>Confirmada por (opcional)</legend>
          <div className="opciones">
            {(Object.keys(NOMBRES_FUENTE) as FuenteEEF[]).map((f) => (
              <label key={f} className={`opcion${fuente === f ? ' seleccionada' : ''}`}>
                <input
                  type="radio"
                  name={`${id}-fuente`}
                  checked={fuente === f}
                  onChange={() => onCambiarFuente(f)}
                />
                {NOMBRES_FUENTE[f]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {concordancia && (
        <p className={`concordancia-eef concordancia-${concordancia}`} data-testid="concordancia-eef">
          Predicción de Arruda frente al EEF: <strong>{NOMBRES_CONCORDANCIA[concordancia]}</strong>
        </p>
      )}
    </div>
  );
}
