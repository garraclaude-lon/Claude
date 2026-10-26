# Limitaciones y puntos a revisar

## Revisión clínica pendiente (obligatoria antes de cualquier uso asistencial)

1. **Las reglas no se verificaron contra el artículo original.** Se implementaron tal como las
   define la especificación del proyecto. Un electrofisiólogo debe compararlas con
   Arruda MS et al., *J Cardiovasc Electrophysiol* 1998;9(1):2-12.
2. **Cita bibliográfica.** Verificar autores, volumen y páginas contra la publicación.
3. **Umbral R/S en V1 (paso 1).** Se usa R > S como criterio de pared libre izquierda, y R = S
   continúa al paso 2. Algunas reproducciones secundarias del algoritmo podrían usar R ≥ S;
   confirmar con el original.
4. **Umbral R/S en III (paso 3).** R = S se trata como indeterminado, según la especificación.
   Confirmar si el artículo asigna R = S a alguna de las dos ramas.
5. **Paso 4, II negativa.** Esta rama es inalcanzable en el recorrido completo: una delta
   negativa en II ya clasifica en el paso 2. Se mantiene (y se prueba de forma aislada) porque
   la especificación la define.
6. **Abreviatura "PS subepicárdica".** Es propia de esta herramienta; no se tomó del artículo.
7. **Definición de isoeléctrica.** La herramienta no mide el ECG: depende de que el usuario
   evalúe correctamente los primeros 20 ms. No hay ayuda visual ni umbrales de amplitud.

## Fuera del alcance de esta versión

- No calcula probabilidades ni confianza estadística (no hay un modelo validado que las sustente).
- No considera vías múltiples, preexcitación mínima/intermitente, cardiopatías congénitas
  (p. ej., Ebstein) ni otras situaciones en las que el algoritmo pierde exactitud.
- No hay validación en población pediátrica dentro de esta herramienta.
- Sin corazón 3D, carga de imágenes de ECG, base de datos, inicio de sesión ni despliegue.
- No se guarda ningún dato; recargar la página borra todo.
