interface Props {
  onElegir: (modo: 'imagen' | 'guiado') => void;
}

export function PantallaInicio({ onElegir }: Props) {
  return (
    <section className="inicio" aria-labelledby="titulo-inicio">
      <h2 id="titulo-inicio">¿Cómo querés trabajar?</h2>
      <div className="inicio-opciones">
        <button type="button" className="tarjeta-modo" onClick={() => onElegir('imagen')}>
          <span className="tarjeta-etiqueta">Versión simple</span>
          <span className="tarjeta-titulo">Desde la imagen del ECG</span>
          <span className="tarjeta-desc">
            Sacá una foto con la cámara o subí el ECG (JPG, PNG, BMP o PDF). La IA propone una lectura
            experimental y vos confirmás cada criterio mirando el trazado.
          </span>
        </button>
        <button type="button" className="tarjeta-modo" onClick={() => onElegir('guiado')}>
          <span className="tarjeta-etiqueta">Algoritmo de Arruda</span>
          <span className="tarjeta-titulo">Cuestionario guiado</span>
          <span className="tarjeta-desc">
            Te pregunta, paso a paso y en el orden del algoritmo, cómo ves la onda delta en cada
            derivación. Solo pide los datos que necesita la rama.
          </span>
        </button>
      </div>
    </section>
  );
}
