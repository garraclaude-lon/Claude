import { useState } from 'react';
import {
  HORAS,
  LEGADO_A_HORA,
  NOMBRES_ANILLO,
  NOMBRES_CONCORDANCIA,
  NOMBRES_FUENTE,
  OTRAS_SITUACIONES,
  POR_CODIGO_EEF,
  ROMANOS,
  sectorHora,
  type AnilloEEF,
  type CodigoEEF,
  type CodigoEEFLegado,
  type Concordancia,
  type FuenteEEF,
  type Hora,
} from '../registro/eef';

interface Props {
  id: string;
  valor: CodigoEEF | null;
  fuente: FuenteEEF | null;
  onCambiar: (v: CodigoEEF | null) => void;
  onCambiarFuente: (v: FuenteEEF | null) => void;
  concordancia: Concordancia | null;
  textoPendiente: string;
  /** Concordancia (y distancia en horas) de cada algoritmo. */
  porAlgoritmo?: { nombre: string; concordancia: Concordancia; horas?: number | null }[];
  /** Distancia en horas de la predicción principal (si hay un solo algoritmo). */
  horas?: number | null;
}

/** Anillo y hora de un código (los códigos viejos se convierten a su hora aproximada). */
function anilloYHora(v: CodigoEEF | null): { anillo: AnilloEEF | null; hora: Hora | null } {
  if (!v) return { anillo: null, hora: null };
  const l = POR_CODIGO_EEF[v];
  if (l?.anillo && l.hora) return { anillo: l.anillo, hora: l.hora };
  const conv = LEGADO_A_HORA[v as CodigoEEFLegado];
  if (conv) {
    const c = POR_CODIGO_EEF[conv];
    return { anillo: c.anillo!, hora: c.hora! };
  }
  return { anillo: null, hora: null };
}

const textoHoras = (h: number | null | undefined) =>
  h === null || h === undefined ? '' : h === 0 ? ' · dentro de la región predicha' : ` · a ${h} ${h === 1 ? 'hora' : 'horas'} del sitio`;

/**
 * Localización confirmada en el EEF con el criterio horario del servicio: anillo
 * (tricuspídeo o mitral) y hora (I a XII), o una situación sin hora. Lista cerrada.
 */
export function SelectorEEF({ id, valor, fuente, onCambiar, onCambiarFuente, concordancia, textoPendiente, porAlgoritmo, horas }: Props) {
  const inicial = anilloYHora(valor);
  const [anillo, setAnillo] = useState<AnilloEEF | null>(inicial.anillo);
  const legado = valor !== null && POR_CODIGO_EEF[valor]?.legado;
  const actual = anilloYHora(valor);
  const valorPrimero = anillo ?? (valor && OTRAS_SITUACIONES.includes(valor) ? valor : '');
  const conSitio = valor !== null && POR_CODIGO_EEF[valor]?.evaluable;

  const cambiar = (v: CodigoEEF | null) => {
    onCambiar(v);
    if (!v || !POR_CODIGO_EEF[v].evaluable) onCambiarFuente(null);
  };

  return (
    <div className="selector-eef">
      <label htmlFor={id} className="selector-eef-etiqueta">
        Localización confirmada en el estudio electrofisiológico
      </label>
      <select
        id={id}
        value={valorPrimero}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'TV' || v === 'MV') {
            setAnillo(v);
            // Si ya había una hora, se conserva en el otro anillo.
            cambiar(actual.hora ? (`${v}_${actual.hora}` as CodigoEEF) : null);
          } else {
            setAnillo(null);
            cambiar((v || null) as CodigoEEF | null);
          }
        }}
      >
        <option value="">{textoPendiente}</option>
        <optgroup label="Anillo AV (con hora)">
          <option value="TV">Anillo tricuspídeo</option>
          <option value="MV">Anillo mitral</option>
        </optgroup>
        <optgroup label="Otras situaciones">
          {OTRAS_SITUACIONES.map((c) => (
            <option key={c} value={c}>
              {POR_CODIGO_EEF[c].nombre}
            </option>
          ))}
        </optgroup>
      </select>

      {anillo && (
        <div className="selector-eef-hora">
          <label htmlFor={`${id}-hora`} className="selector-eef-etiqueta">
            Hora en el anillo {NOMBRES_ANILLO[anillo].toLowerCase()} (vista OAI, XII arriba)
          </label>
          <select
            id={`${id}-hora`}
            value={!legado && actual.anillo === anillo && actual.hora ? String(actual.hora) : ''}
            onChange={(e) => cambiar(e.target.value ? (`${anillo}_${e.target.value}` as CodigoEEF) : null)}
          >
            <option value="">Elegí la hora</option>
            {HORAS.map((h) => (
              <option key={h} value={h}>
                {ROMANOS[h]} — {sectorHora(anillo, h)}
              </option>
            ))}
          </select>
        </div>
      )}

      {legado && valor && (
        <p className="nota" data-testid="eef-legado">
          Cargado con la lista anterior: <strong>{POR_CODIGO_EEF[valor].nombre}</strong>. Elegí la hora para
          pasarlo al criterio horario.
        </p>
      )}

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

      {concordancia && porAlgoritmo && porAlgoritmo.length > 1
        ? porAlgoritmo.map((a) => (
            <p key={a.nombre} className={`concordancia-eef concordancia-${a.concordancia}`} data-testid="concordancia-eef">
              Predicción de {a.nombre} frente al EEF: <strong>{NOMBRES_CONCORDANCIA[a.concordancia]}</strong>
              {textoHoras(a.horas)}
            </p>
          ))
        : concordancia && (
            <p className={`concordancia-eef concordancia-${concordancia}`} data-testid="concordancia-eef">
              Predicción de {porAlgoritmo?.[0]?.nombre ?? 'Arruda'} frente al EEF: <strong>{NOMBRES_CONCORDANCIA[concordancia]}</strong>
              {textoHoras(porAlgoritmo?.[0]?.horas ?? horas)}
            </p>
          )}
    </div>
  );
}
