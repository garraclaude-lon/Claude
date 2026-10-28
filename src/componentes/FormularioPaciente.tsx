import { useState } from 'react';
import {
  describirPaciente,
  EDAD_MAX_ANIOS,
  grupoEtario,
  NOMBRES_GRUPO,
  NOMBRES_SEXO,
  validarDatosPaciente,
  type DatosPaciente,
  type Sexo,
} from '../registro/paciente';

interface Props {
  inicial?: DatosPaciente | null;
  onConfirmar: (datos: DatosPaciente) => void;
}

const SEXOS: Sexo[] = ['femenino', 'masculino', 'no_consignado'];

/** Pide sexo y edad (años y meses cumplidos). Sin nombre ni documento. */
export function FormularioPaciente({ inicial, onConfirmar }: Props) {
  const [sexo, setSexo] = useState<string | null>(inicial?.sexo ?? null);
  const [anios, setAnios] = useState(inicial ? String(inicial.edadAnios) : '');
  const [meses, setMeses] = useState(inicial ? String(inicial.edadMeses) : '');
  const [intentado, setIntentado] = useState(false);

  const { datos, errores } = validarDatosPaciente(sexo, anios, meses);
  const mostrar = (k: keyof typeof errores) => (intentado ? errores[k] : undefined);

  return (
    <form
      className="form-paciente"
      aria-labelledby="titulo-paciente"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setIntentado(true);
        if (datos) onConfirmar(datos);
      }}
    >
      <h2 id="titulo-paciente">Datos del paciente</h2>
      <p className="ayuda">
        Solo para estadísticas anónimas del servicio. No escribas nombre, documento ni historia clínica.
      </p>

      <fieldset className="campo" aria-invalid={mostrar('sexo') ? true : undefined} aria-describedby="error-sexo">
        <legend>Sexo</legend>
        <div className="opciones">
          {SEXOS.map((s) => (
            <label key={s} className={`opcion${sexo === s ? ' seleccionada' : ''}`}>
              <input type="radio" name="sexo" value={s} checked={sexo === s} onChange={() => setSexo(s)} />
              {NOMBRES_SEXO[s]}
            </label>
          ))}
        </div>
        {mostrar('sexo') && <p id="error-sexo" className="error-campo">{errores.sexo}</p>}
      </fieldset>

      <fieldset className="campo">
        <legend>Edad (cumplida)</legend>
        <div className="edad">
          <label className="edad-campo">
            <span>Años</span>
            <input
              id="edad-anios"
              type="number"
              inputMode="numeric"
              min={0}
              max={EDAD_MAX_ANIOS}
              step={1}
              value={anios}
              onChange={(e) => setAnios(e.target.value)}
              aria-invalid={mostrar('edadAnios') ? true : undefined}
            />
          </label>
          <label className="edad-campo">
            <span>Meses</span>
            <input
              id="edad-meses"
              type="number"
              inputMode="numeric"
              min={0}
              max={11}
              step={1}
              placeholder="0"
              value={meses}
              onChange={(e) => setMeses(e.target.value)}
              aria-invalid={mostrar('edadMeses') ? true : undefined}
            />
          </label>
          {datos && (
            <span className="grupo-etario" data-testid="grupo-etario">
              {NOMBRES_GRUPO[grupoEtario(datos)]}
            </span>
          )}
        </div>
        {mostrar('edadAnios') && <p className="error-campo">{errores.edadAnios}</p>}
        {mostrar('edadMeses') && <p className="error-campo">{errores.edadMeses}</p>}
        <p className="ayuda">Ejemplo: 4 meses → 0 años y 4 meses. 7 años y medio → 7 años y 6 meses.</p>
      </fieldset>

      <div className="acciones">
        <button type="submit" className="boton-primario">
          Continuar
        </button>
      </div>
    </form>
  );
}

/** Muestra los datos del paciente con opción de corregirlos sin perder el análisis. */
export function EncabezadoPaciente({ datos, onCambiar }: { datos: DatosPaciente; onCambiar: (d: DatosPaciente) => void }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <FormularioPaciente
        inicial={datos}
        onConfirmar={(d) => {
          onCambiar(d);
          setEditando(false);
        }}
      />
    );
  }
  return (
    <p className="chip-paciente" data-testid="chip-paciente">
      <span>
        Paciente: <strong>{describirPaciente(datos)}</strong>
      </span>
      <button type="button" className="boton-texto" onClick={() => setEditando(true)}>
        Corregir
      </button>
    </p>
  );
}
