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

Sectores confirmados por las figuras de patrones ECG por hora aportadas por el equipo.

| Hora | Sector (figura) | Región | Sigla en la app |
|---|---|---|---|
| XI–XII | Anterior (A) | Anterior derecha | DA/DAL |
| IX–X | Lateral‑anterior (LA) | Anterolateral / lateral derecha | DA/DAL (IX también DL) |
| VIII | Lateral‑posterior (LP) | Posterolateral derecha | DP/DPL |
| VI–VII | Posterior (P) | Posterior derecha | DP/DPL |
| V | Posteroseptal (PS) | Posteroseptal derecha | PST |
| IV | Medioseptal posterior (MSP) | Entre medioseptal y posteroseptal | MST o PST (provisorio) |
| III | Medioseptal (MS) | Medioseptal | MST |
| I–II | Anteroseptal (AS) | Anteroseptal / parahisiana (His entre I y II) | AS/PSAD |

## Anillo mitral (MV)

| Hora | Sector (figura) | Región | Sigla en la app |
|---|---|---|---|
| I–III | Lateral (L) | Lateral / anterolateral izquierda | IL/IAL |
| IV | Posterolateral alta (HPL, *high posterolateral*) | Posterolateral izquierda | IP/IPL |
| V | Posterolateral baja (LPL, *low posterolateral*) | Posterolateral izquierda | IP/IPL |
| VI–VII | Posterior y posteroseptal (PS & P) | Posteroseptal o posterior izquierda | PSM o IP/IPL |
| VIII | Posteroseptal | Posteroseptal izquierda | PSM |
| IX–XII | Sin color: septal anterior y continuidad mitroaórtica | Sin vías en el esquema | — |

## Polaridad de la onda delta en las inferiores (II, III, aVF)

La figura colorea cada anillo según la polaridad esperada de la onda delta en **II, III y aVF**:

| Color | Significado | Tricuspídeo | Mitral |
|---|---|---|---|
| Rojo | II, III y aVF **positivas** | aprox. X → XII → III (anterior, anteroseptal y medioseptal) | aprox. I → IV (lateral) |
| Violeta | Transición | aprox. X y III–IV | aprox. IV–V |
| Azul | II, III y aVF **negativas** | aprox. IV → IX (posteroseptal, posterior y lateral posterior) | aprox. V → VIII (posterolateral, posterior y posteroseptal) |

Es la regla de los algoritmos: cuanto más negativa la delta en las inferiores, más posterior la vía.

## Uso en la app

La localización confirmada en el EEF se carga como **anillo + hora** (por ejemplo, "Tricuspídeo V"
o "Mitral IV"). La hora se convierte a las regiones de la app con estas tablas
(`src/registro/eef.ts`) y se guarda también la hora exacta, para medir a cuántas horas del sitio
real quedó cada algoritmo. Mientras no se confirmen los puntos de abajo, TV IV cuenta como acierto
para MST o PST, y MV VI–VII para PSM o IP/IPL.

## Patrones ECG por hora (figuras del equipo)

El equipo aportó dos láminas con el **ECG de 12 derivaciones típico de cada sector** (una para el
tricuspídeo, con 8 sectores, y otra para el mitral, con 4). Confirman los sectores y las horas de
las tablas de arriba y la regla de las inferiores: delta **positiva** en II, III y aVF en los
sectores anteriores y laterales del mitral; **negativa** en los posteriores y posteroseptales.

La polaridad derivación por derivación de cada patrón **no se transcribió**: las imágenes llegaron
con baja resolución y una lectura equivocada contaminaría el algoritmo. Hace falta la figura en
archivo de mayor resolución (o la fuente original) para cargarla como tabla de patrones.

## Puntos a confirmar con el equipo

1. ~~Significado de MSP, HPL y LPL~~ — resuelto por las figuras: medioseptal posterior,
   posterolateral alta (*high*) y posterolateral baja (*low*).
2. **TV IV (MSP):** ¿se cuenta como acierto para medioseptal (MST), posteroseptal (PST) o ambos?
   Hoy: ambos.
3. **MV VI–VII (posterior y posteroseptal):** hoy cuenta como acierto para PSM o IP/IPL.
4. **TV IX:** la figura lo incluye en lateral‑anterior (IX–X); hoy cuenta para DA/DAL y para DL
   (derecha lateral de Arruda).
