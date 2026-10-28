# Registro de análisis (esquema 1)

Cada análisis que se guarda con **"Guardar en el registro"** queda como un documento en la
colección `analisis` de la base de datos privada de la página publicada en claude.ai.
**No se guardan imágenes, nombres, documentos ni texto libre.**

## Campos

| Campo | Ejemplo | Descripción |
|---|---|---|
| `esquema` | `1` | Versión de este formato. |
| `versionApp` | `"0.3.0"` | Versión de la app que guardó el registro. |
| `versionAlgoritmo` | `"arruda-1998-impl-0.1.0"` | Versión de las reglas usadas. |
| `modo` | `"imagen"` | `imagen`, `guiado` o `formulario`. |
| `paciente.sexo` | `"femenino"` | `femenino`, `masculino` o `no_consignado`. |
| `paciente.edadAnios` / `edadMeses` | `0` / `4` | Edad cumplida. |
| `paciente.edadTotalMeses` | `4` | Años × 12 + meses (para análisis continuos). |
| `paciente.grupoEtario` | `"lactante"` | Ver cortes abajo. |
| `criterios` | `{ "deltaI": "positiva", … }` | Valores **confirmados** por el profesional. `null` = no hizo falta preguntarlo. |
| `resultado.estado` | `"region_predicha"` | `region_predicha`, `datos_insuficientes`, `indeterminado` o `no_clasificable`. |
| `resultado.regiones` | `["PSTA_CSOS"]` | Códigos de región (dos si el algoritmo no discrimina: `["PSTA","PSMA"]`). |
| `ia` | `null` o `{ valores, calidad, esECG, criteriosRevisados, coincidencias }` | Propuesta de la IA, si se usó. |
| `creadoEn` / `actualizadoEn` | ISO 8601 | Momento del análisis (no es la fecha del ECG). |
| `creadoPor` | id opaco | Identifica qué cuenta guardó el registro (no al paciente). |

## Grupos etarios

| Grupo | Corte |
|---|---|
| Neonato | 0 años y 0 meses (aproxima 0–28 días) |
| Lactante | 1 a 11 meses |
| Preescolar | 1 a 5 años |
| Escolar | 6 a 11 años |
| Adolescente | 12 a 17 años |
| Adulto | 18 años o más |

Los cortes son una convención de esta herramienta; revisarlos con el servicio. Como también se
guarda la edad exacta en meses, se pueden reagrupar después sin perder información.

## Duplicados

Si se corrige un dato después de guardar ("Atrás", "Corregir"), se **actualiza el mismo
registro**. Un paciente nuevo ("Analizar otro paciente") crea un registro nuevo. Si un mismo
paciente se analiza dos veces en momentos distintos, quedan dos registros: no hay forma de
detectarlo sin un identificador, que a propósito no se guarda.

## Acceso

- La página es privada. Solo quienes reciban acceso desde **Compartir** pueden abrirla.
- Para **guardar** hace falta acceso de **Colaborador** o superior. Con acceso de
  **Lector** se ve el resumen, pero no se puede guardar.
- Todos los que tienen acceso ven todos los registros (son anónimos).
- Capacidad máxima: 25.000 documentos por página.
