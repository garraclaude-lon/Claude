# Algoritmos de localización de vías accesorias: estado de la recopilación

Objetivo: implementar cada algoritmo tal como fue publicado, unificar sus regiones con las siglas en
español de la app (ver `docs/ALGORITMO.md`) y combinarlos en un algoritmo nuevo para "Subir ECG".

**Regla:** solo se programa un algoritmo cuando su árbol de decisión está completo y verificado contra
el artículo original o su figura. Las fuentes secundarias sirven de guía, no de base.

| Algoritmo | Criterios | Estado | Fuente usada |
|---|---|---|---|
| Arruda 1998 | Delta en I, II, aVF, aVR, V1; R/S en V1 y III | **Implementado** | Artículo original |
| EPM 2024 | Delta en DI/aVL y DIII; R>S en V1; transición QRS | **Completo** (falta definir delta isoeléctrica) | Figura aportada por el equipo — ver `EPM.md` |
| Iturralde 1996 | Polaridad del QRS en III, V1, V2 | **Casi completo** (patrones del resumen; falta el orden exacto y los casos mixtos) | Resumen del artículo (PubMed 8913903) |
| Taguchi 2013 | R/S en V1, V2 y aVF | **Parcial** | Resúmenes secundarios |
| EASY-WPW 2023 | Polaridad del QRS en V1, transición QRS, derivación con delta más positiva | **Implementado** — comparación en "Subir ECG" | Resumen gráfico aportado por el equipo — ver `EASY-WPW.md` |
| Chiang 1995 | R/S en V1, delta en I, III y V1 | **Parcial** (falta el paso 2) | Estudio de validación pediátrica |
| Fitzpatrick 1994 | Transición R/S, suma de deltas en II, III, aVF, vector delta | **Parcial** | Resúmenes secundarios |
| d'Avila 1995 | Polaridad del QRS | **Sin datos** del árbol | — |
| Sousa Ferro 2025 | Revisión comparativa (no es un algoritmo) | Solo cita | — |
| SMART-WPW 2025 | Delta en V1, polaridad en V3, cuántas inferiores negativas; 12 sitios en reloj | **Implementado** — algoritmo principal de "Subir ECG" (97 % en 260 pacientes; 97 % frente a 62 % de Arruda en menores de 18) | PDF del artículo aportado por el equipo — ver `SMART-WPW.md` |

## Iturralde 1996 — patrones (resumen del artículo, 102 pacientes adultos)

Polaridad del **QRS** (no de la delta) en III, V1 y V2:

| III | V1 | V2 | Localización | Sigla app | Sens. / Esp. |
|---|---|---|---|---|---|
| + | + | | Izquierda posterolateral (pared libre) | IL/IAL o IP/IPL (a definir) | 91 % / 95 % |
| − | + | | Izquierda paraseptal inferior o inferior | PSM / IP | 84 % |
| + | − | | Derecha paraseptal anterosuperior | AS/PSAD | 100 % / 97 % |
| − o ± | − o ± | + | Derecha paraseptal inferior o inferior | PST | 84 % |
| − | − | − | Derecha anterior | DA/DAL | 83 % |

En niños, el algoritmo de adultos acertó 55–58 %; los autores propusieron una versión pediátrica
(PubMed 12521337) que separa izquierda lateral de posteroseptal izquierda por la polaridad en III.

## Taguchi 2013 — lo confirmado

- R/S en V1 ≥ 0,5 → pared libre mitral (todos los izquierdos de pared libre de la validación).
  - R/S en aVF ≥ 1 → izquierda anterior o lateral.
- R/S en V1 < 0,5 y en V2 ≥ 0,5 → medioseptal o posteroseptal.
- R/S en V1 < 0,5 y en V2 < 0,5 → pared libre derecha o anteroseptal derecha.
  - R/S en aVF ≥ 1 → derecha anterior, lateral o anteroseptal.
- Falta: la rama con aVF < 1 en cada caso y cómo separa medioseptal de posteroseptal.

## Chiang 1995 — lo confirmado

- Paso 1: R/S en V1 ≥ 1 → izquierda; < 1 → se evalúa la delta en I.
- Paso 3: delta en III separa septal derecha parcial de pared libre derecha.
- Paso 4: delta en V1 separa septal derecha de pared libre derecha.
- Falta: el paso 2 completo.

## Fitzpatrick 1994 — lo confirmado

- Paso 1: transición R/S en precordiales (R > S por más o menos de 1 mV) → derecha o izquierda.
- Paso 2: suma de polaridades de la delta en II, III y aVF → septal o lateral.
- También usa el vector frontal de la delta y la polaridad en V1.
- Falta: los umbrales y ramas exactas.

## Precisión en niños (contexto)

- 100 niños con WPW: precisión exacta 24–53 % en vías derechas y 32–55 % en izquierdas; ninguno
  bueno en medioseptales o anteroseptales derechas (Heart 2012;98:202).
- EASY-WPW: 93–94 % en el estudio original (58 niños incluidos); 59 % en una validación
  independiente de 122 pacientes.

## Para completar

Se necesitan los diagramas de: Taguchi, Chiang, Fitzpatrick y d'Avila (e Iturralde para confirmar el orden).
Los sitios con el texto completo (academic.oup.com, pmc.ncbi.nlm.nih.gov, sciencedirect.com,
pubmed.ncbi.nlm.nih.gov) están bloqueados en esta sesión; se pueden habilitar en Network access o
subir las figuras como imagen.
