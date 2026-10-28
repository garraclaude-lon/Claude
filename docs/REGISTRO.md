# Registro de análisis (esquema 2)

Cada análisis que se guarda con **"Guardar en el registro"** queda como un documento en la
colección `analisis` de la base de datos privada de la página publicada en claude.ai.
**No se guardan imágenes, nombres, documentos ni texto libre.**

## Campos

| Campo | Ejemplo | Descripción |
|---|---|---|
| `esquema` | `2` | Versión de este formato. |
| `codigo` | `"WPW-7F3KAB"` | Código del registro (también es el id del documento). |
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
| `eef` | `null` o `{ localizacion, fuente, concordancia }` | Resultado del estudio electrofisiológico. `null` = pendiente. |
| `eef.localizacion` | `"LL"` | Sitio confirmado (ver tabla abajo). |
| `eef.fuente` | `"ablacion_exitosa"` | `ablacion_exitosa`, `mapeo_sin_ablacion` o `null` (no informado). |
| `eef.concordancia` | `"concordante"` | `concordante`, `parcial`, `discordante`, `sin_prediccion` o `no_evaluable`. |
| `creadoEn` / `actualizadoEn` | ISO 8601 | Momento del análisis (no es la fecha del ECG). |
| `creadoPor` | id opaco | Identifica qué cuenta guardó el registro (no al paciente). |

## Código del registro

Cada análisis guardado recibe un código `WPW-` + 6 caracteres. Solo usa letras y números que no
se confunden al copiarlos a mano (no usa 0, O, 1, I ni L). La idea es **anotarlo en la historia
clínica**: así el registro sigue siendo anónimo en claude.ai y la relación entre código y paciente
queda solo dentro del hospital. Con ese código se carga después el resultado del EEF.

## Estudio electrofisiológico: sitios y correspondencia con Arruda

La concordancia se calcula comparando la región predicha con las regiones "compatibles" del
sitio confirmado. **Esta tabla es una propuesta de la herramienta y la debe revisar el equipo
de electrofisiología** (está en `src/registro/eef.ts`).

| Código | Sitio confirmado | Regiones de Arruda que coinciden |
|---|---|---|
| `LAL` | Anterolateral izquierda | LL/LAL |
| `LL` | Lateral izquierda | LL/LAL |
| `LPL` | Posterolateral izquierda | LP/LPL |
| `LP` | Posterior izquierda | LP/LPL |
| `PSMA` | Posteroseptal mitral (izquierda) | PSMA |
| `AS_PH` | Anteroseptal / parahisiana | AS/RAPS |
| `MS` | Medioseptal | MSTA |
| `PSTA` | Posteroseptal tricuspídea (derecha) | PSTA/CSOs, PSTA |
| `CSOS` | Región del ostium del seno coronario (endocárdica) | PSTA/CSOs |
| `PS_SUBEPI` | Posteroseptal subepicárdica (seno coronario, vena cardíaca media o divertículo) | PS subepicárdica |
| `RA` / `RAL` | Anterior / anterolateral derecha | RA/RAL |
| `RL` | Lateral derecha | RL |
| `RPL` / `RP` | Posterolateral / posterior derecha | RP/RPL |
| `MULTIPLES` | Vías accesorias múltiples | — (no evaluable) |
| `NO_LOCALIZADA` | No localizada / estudio no concluyente | — (no evaluable) |

Cuándo se considera coincidencia:
- **concordante:** la región predicha está entre las compatibles.
- **parcial:** el algoritmo dio dos opciones (PSTA o PSMA) y una coincide. En el porcentaje de
  coincidencia **no** se cuenta como acierto.
- **discordante:** hubo predicción y no coincide.
- **sin_prediccion:** el algoritmo no dio región (indeterminado, incompleto o no clasificable).
- **no_evaluable:** vías múltiples o sitio no localizado.

El porcentaje de coincidencia que muestra la pantalla de inicio es
`concordantes / (concordantes + parciales + discordantes)`.

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
