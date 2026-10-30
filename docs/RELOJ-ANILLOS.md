# Esquema horario de los anillos AV (criterio del servicio)

Criterio que usa el equipo de electrofisiología para informar la localización de la vía
accesoria en los estudios electrofisiológicos (EEF): la posición se da como una **hora** sobre el
anillo **tricuspídeo (TV)** o **mitral (MV)**.

**Fuente:** esquema aportado por el equipo (figura de los anillos AV vistos en OAI, con números
romanos). La figura original no se incluye en este repositorio público; esta es su transcripción.

## Orientación

- Vista **oblicua anterior izquierda (OAI)**, como si se mirara el plano valvular desde el ápex.
- **XII** arriba (superior). Las horas avanzan en sentido horario: **III** a la derecha de la
  imagen y **IX** a la izquierda.
- El **tricuspídeo** queda a la izquierda de la imagen y el **mitral** a la derecha; el septum
  queda entre ambos.
- Referencias anatómicas: **His** y **nódulo AV (AVN)** en el borde septal superior del anillo
  tricuspídeo (entre I y III); **ostium del seno coronario (CS)** en el septum inferior (hacia
  IV–V del tricuspídeo).

## Anillo tricuspídeo (TV)

| Hora | Rótulo en la figura | Región | Sigla en la app |
|---|---|---|---|
| XI–XII | A (anterior) | Anterior derecha | DA/DAL |
| I | AS (anteroseptal) | Anteroseptal derecha (His entre I y II) | AS/PSAD |
| II | — (entre AS y MS; parahisiano) | Anteroseptal / parahisiana | AS/PSAD |
| III | MS (medioseptal) | Medioseptal | MST |
| IV | MSP | Medioseptal posterior (a confirmar) | MST o PST (a definir) |
| V | PS (posteroseptal) | Posteroseptal derecha | PST |
| VI–VII | P (posterior) | Posterior derecha | DP/DPL |
| VIII | LP (lateral posterior) | Posterolateral derecha | DP/DPL |
| IX | — | Lateral derecha | DL |
| X | LA (lateral anterior) | Anterolateral derecha | DA/DAL |

## Anillo mitral (MV)

| Hora | Rótulo en la figura | Región | Sigla en la app |
|---|---|---|---|
| I–III | L (lateral) | Lateral / anterolateral izquierda | IL/IAL |
| IV | HPL | Posterolateral alta (a confirmar) | IP/IPL |
| V | LPL | Posterolateral baja (a confirmar) | IP/IPL |
| VI–VII | PS & P | Posteroseptal y posterior izquierda | PSM / IP (a definir) |
| VIII | — | Posteroseptal izquierda | PSM |
| IX–XII | (sin color) | Septal anterior y continuidad mitroaórtica: sin vías en el esquema | — |

## Polaridad de la onda delta en las inferiores (II, III, aVF)

La figura colorea cada anillo según la polaridad esperada de la onda delta en **II, III y aVF**:

| Color | Significado | Tricuspídeo | Mitral |
|---|---|---|---|
| Rojo | II, III y aVF **positivas** | aprox. X → XII → III (anterior, anteroseptal y medioseptal) | aprox. I → IV (lateral) |
| Violeta | Transición | aprox. X y III–IV | aprox. IV–V |
| Azul | II, III y aVF **negativas** | aprox. IV → IX (posteroseptal, posterior y lateral posterior) | aprox. V → VIII (posterolateral, posterior y posteroseptal) |

Es la regla de los algoritmos: cuanto más negativa la delta en las inferiores, más posterior la vía.

## Uso previsto en la app

Cuando se carguen los informes de EEF, la localización confirmada se podrá registrar como
**anillo + hora** (por ejemplo, "TV V" o "MV IV"). La hora se convierte a las regiones de la app con
estas tablas, y se guarda también la hora exacta para análisis más finos (por ejemplo, error en
horas entre la predicción y el sitio real).

## Puntos a confirmar con el equipo

1. Significado de **MSP**, **HPL** y **LPL** (propuesta: medioseptal posterior, posterolateral alta
   y posterolateral baja).
2. **TV IV (MSP):** ¿se cuenta como medioseptal (MST) o posteroseptal (PST)?
3. **MV VI–VII (PS & P):** ¿posteroseptal izquierda (PSM) o posterior izquierda (IP/IPL)?
4. Límites exactos de cada sector (la lectura de la figura es aproximada a la hora entera).
