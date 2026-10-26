export function ExplicacionAlgoritmo() {
  return (
    <section className="explicacion" aria-labelledby="titulo-explicacion">
      <h2 id="titulo-explicacion">Secuencia de decisiones (algoritmo de Arruda, 1998)</h2>
      <p>
        Las ramas se evalúan en este orden. La primera que se cumple define la región; los pasos
        siguientes no se consultan.
      </p>
      <ol>
        <li>
          <strong>Pared libre izquierda.</strong> Delta en I negativa o isoeléctrica, <em>o</em> R
          &gt; S en V1. Luego aVF: positiva → LL/LAL; isoeléctrica o negativa → LP/LPL.
        </li>
        <li>
          <strong>Posteroseptal subepicárdica.</strong> Delta en II negativa.
        </li>
        <li>
          <strong>Septal.</strong> Delta en V1 negativa o isoeléctrica. Luego aVF: negativa →
          PSTA/CSOs; isoeléctrica → PSTA o PSMA; positiva → R/S en III (R &gt; S → AS/RAPS; R &lt; S →
          MSTA; R = S o no evaluable → indeterminado).
        </li>
        <li>
          <strong>Pared libre derecha.</strong> Delta en aVR positiva → RA/RAL. Si no, II: positiva
          → RL; isoeléctrica → RP/RPL; negativa → no clasificable.
        </li>
      </ol>
      <dl className="glosario">
        <dt>Región predicha</dt>
        <dd>Las reglas llevan a una localización (o a dos que el algoritmo no distingue).</dd>
        <dt>Datos insuficientes</dt>
        <dd>Falta completar un dato que la rama necesita. Nunca se asume un valor.</dd>
        <dt>Resultado indeterminado</dt>
        <dd>El dato está cargado (p. ej., “no evaluable” o R = S en III) pero las reglas no permiten decidir.</dd>
        <dt>No clasificable</dt>
        <dd>La combinación no está contemplada por las reglas especificadas.</dd>
      </dl>
    </section>
  );
}
