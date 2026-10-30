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

## Modelo 3D (Ubicación 3D)

1. **Anatomía de referencia, no del paciente.** El corazón es el de un adulto (Z-Anatomy /
   BodyParts3D). No hay un modelo pediátrico ni datos de TC o RM del paciente.
2. **Sistema de conducción aproximado.** Los nódulos y trayectos se calcularon automáticamente
   sobre la malla: el nódulo sinusal en la unión de la vena cava superior con la AD; el AV entre el
   ostium del seno coronario y la valva septal tricuspídea; el His hacia la cresta del septum.
   La rama derecha baja por la cara derecha del septum y cruza por la banda moderadora hasta el
   papilar anterior del VD. La rama izquierda es un tronco corto que se divide en la hemirrama
   anterior (hacia el papilar anterolateral) y la posterior (hacia el posteromedial), con fibras
   septales intermedias en abanico. La red de Purkinje se simplificó a sus ramas principales, que
   crecen sobre el endocardio desde los haces (con semilla fija, siempre igual). El estilo visual
   (tono neutro, interior rojizo, conducción amarilla pálida) se tomó de imágenes de referencia
   aportadas por el equipo, usadas solo como guía. Son ilustrativos, no anatómicamente exactos.
   No se encontró un modelo abierto de las ramas y hemirramas con licencia compatible
   (el de Leiden-Delft-Groningen es CC BY-NC-SA), por eso se trazan por cálculo.
3. **Válvulas AV y papilares esquemáticos.** La tricúspide (valvas septal, anterior y posterior) y
   la mitral (anterior y posterior) se dibujan de forma minimalista sobre los anillos estimados, y
   se abren y cierran con el ciclo. La valva septal se orienta hacia el septum y la anterior mitral
   hacia la válvula aórtica. El atlas trae un solo papilar del VI y queda sobre la pared lateral:
   los papilares anterolateral y posteromedial se ubican en forma esquemática según el eje corto.
   Los papilares del VD usan la posición del atlas.
4. **Anillos AV estimados.** Se ajustaron a la zona de contacto entre aurícula y ventrículo. El LED
   usa los mismos ángulos que el esquema 2D. Esa correspondencia debe revisarla el equipo de
   electrofisiología.
5. **Tiempos ilustrativos.** El ciclo dura 0,75 s (unos 80 lpm). Los retrasos y el cruce por la vía
   accesoria son didácticos, no medidos.
6. **Requiere WebGL.** En equipos sin aceleración gráfica puede ir lento; si no hay WebGL, se avisa
   y queda el esquema 2D.
7. **Licencia.** El modelo se distribuye bajo CC BY-SA 4.0 con atribución visible en el visor
   (docs/LICENCIA-MODELO-3D.md). El paquete del que se obtuvo marca su propia revisión de licencias
   como "pendiente"; las licencias de origen (Z-Anatomy CC BY-SA 4.0, BodyParts3D CC BY 4.0) son
   públicas.

## Detección de datos personales en la imagen

1. **Cómo funciona.** Al cargar la imagen, Claude busca nombre, apellido, documento, historia
   clínica, fecha de nacimiento, dirección o teléfono. Solo informa el **tipo** de dato y **dónde**
   está; se le pide no transcribirlo. Si encuentra algo, aparece una alerta roja y la imagen se
   recorta (si los datos están en una franja superior o inferior) o se tapan las zonas con negro.
   La imagen original se descarta y lo que sigue usa la versión anonimizada.
2. **La primera revisión ve la imagen original.** Para detectar los datos, Claude tiene que ver
   la imagen tal como se cargó, nombre incluido. No se guarda, pero viaja a Claude con la cuenta
   de quien usa la app. Si eso no es aceptable para el comité, hay que anonimizar la imagen antes
   de cargarla.
3. **Puede fallar.** Puede no ver un dato (letra chica, foto borrosa, texto escrito a mano) o
   ubicarlo con poca precisión. Por eso las zonas se agrandan un margen, se puede **tapar a mano**
   cualquier zona y la app pide confirmar que la imagen está libre de datos antes de la lectura.
4. **Fuera de claude.ai no hay detección automática.** Al ejecutar la app en local se avisa y
   queda solo la herramienta manual.
5. **Nombre del archivo.** Después de anonimizar, la app deja de mostrar el nombre del archivo,
   que también puede contener el nombre del paciente.

## Lectura automática con IA (experimental)

1. **No está validada.** Nadie midió su exactitud para leer la onda delta. Por eso nunca se usa
   sin confirmación y la tabla de concordancia se presenta solo como dato descriptivo.
2. **Resolución.** Antes de enviarla, la plataforma reduce la imagen a unos 1,2 megapíxeles. En un
   ECG de 12 derivaciones completo, los primeros 20 ms de la onda delta pueden no distinguirse.
3. **Fotos.** Reflejos, perspectiva, papel doblado o derivaciones sin rótulo empeoran la lectura.
4. **Datos personales.** Ver "Detección de datos personales en la imagen" arriba.
5. **Uso de la cuenta.** Cada lectura consume el uso de Claude de quien la pide.
6. **Cámara.** Se usa la cámara del sistema, a través del selector de archivos del celular. No hay
   vista previa en vivo dentro de la página. En computadoras se abre el selector de archivos.
7. **PDF.** Solo se procesa la primera página.

## Registro de pacientes

1. **Autorización.** Guardar datos de pacientes con fines de investigación, aunque sean
   anónimos, normalmente requiere la aprobación del comité de ética o de docencia e
   investigación del hospital. Confirmarlo antes de usar el registro con casos reales.
2. **Anonimato.** Sexo y edad solos no identifican, pero combinados con fechas y una patología
   poco frecuente podrían hacerlo en una población chica. Por eso no se guarda la fecha del ECG
   ni texto libre.
3. **Correspondencia EEF–Arruda.** La tabla que decide si la predicción "coincide" con el sitio
   confirmado (docs/REGISTRO.md) es una propuesta de esta herramienta. La debe revisar el equipo
   de electrofisiología antes de usar el porcentaje de coincidencia en un trabajo científico.
   Puntos dudosos: si un sitio posteroseptal mitral (PSMA) debería coincidir también con LP/LPL,
   y cómo contar los casos "parciales" (PSTA o PSMA).
4. **Código del registro.** Anotarlo en la historia clínica vincula el registro con el paciente
   dentro del hospital (seudonimización). Ese vínculo tiene que quedar bajo las mismas reglas de
   confidencialidad que la historia clínica.
5. **Duplicados.** Un mismo paciente analizado dos veces queda como dos registros (ver
   docs/REGISTRO.md).

## Dependencias de desarrollo

`npm audit` no informa vulnerabilidades en lo que llega a la app (`--omit=dev`). Sí informa
vulnerabilidades en Vite y Vitest, que se usan solo para desarrollar y probar. Afectan al
servidor de desarrollo, que aquí escucha solo en `127.0.0.1`. Conviene actualizarlas a sus
versiones mayores siguientes en una tarea aparte, volviendo a correr las pruebas.

## Fuera del alcance de esta versión

- No calcula probabilidades ni confianza estadística (no hay un modelo validado que las sustente).
- No considera vías múltiples, preexcitación mínima/intermitente, cardiopatías congénitas
  (p. ej., Ebstein) ni otras situaciones en las que el algoritmo pierde exactitud.
- No hay validación en población pediátrica dentro de esta herramienta.
- Sin inicio de sesión ni despliegue público.
- No se guarda ninguna imagen. Los datos anónimos se guardan solo al pulsar "Guardar en el registro".
