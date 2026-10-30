# Algoritmo EASY-WPW (El Hamriti et al., 2023)

**Referencia:** El Hamriti M, Braun M, Molatta S, Imnadze G, Khalaph M, Lucas P, et al. EASY-WPW:
a novel ECG-algorithm for easy and reliable localization of manifest accessory pathways in
children and adults. Europace 2023;25(2):600–9. DOI 10.1093/europace/euac216.

**Fuente de esta transcripción:** resumen gráfico del artículo aportado por el equipo
("Flow-chart for stepwise accessory pathway-identification").

**Población:** estudio multicéntrico, 211 pacientes con una vía manifiesta (incluye 58 niños);
desarrollo retrospectivo, prueba prospectiva y validación externa.

## Definiciones

- **Polaridad en V1:** positiva, o negativa/isoeléctrica.
- **Transición del QRS:** derivación precordial donde el QRS pasa a ser predominantemente positivo.
- **Onda delta más positiva:** la derivación, entre **II, III, aVR y aVL**, con la onda delta más
  positiva (si la delta no se distingue bien, el QRS más positivo).

## Pasos

### Paso 1 — V1

| V1 | Anillo |
|---|---|
| Positiva | **Mitral** (vía izquierda) → paso 2 izquierdo |
| Negativa o isoeléctrica | **Tricuspídeo** (vía derecha) → paso 2 derecho |

### Vías izquierdas (2 pasos)

Paso 2 — derivación con la onda delta más positiva:

| Delta más positiva en | Sitio EASY | Sigla app | Código |
|---|---|---|---|
| aVL | PS izquierda (posteroseptal) | PSM | `PSMA` |
| II o aVR | PL izquierda (posterolateral) | IP/IPL | `LP_LPL` |
| III | AL izquierda (anterolateral) | IL/IAL | `LL_LAL` |

### Vías derechas (3 pasos)

Paso 2 — ¿transición del QRS ≤ V3?

Paso 3 — derivación con la onda delta más positiva:

| Transición ≤ V3 | Delta más positiva en | Sitio EASY | Sigla app | Código |
|---|---|---|---|---|
| Sí | II o III | AS derecha (anteroseptal) | AS/PSAD | `AS_RAPS` |
| Sí | aVL o aVR | PS derecha (posteroseptal) | PST | `PSTA` |
| No | II | AL derecha (anterolateral) | DA/DAL | `RA_RAL` |
| No | III | AS derecha (anteroseptal) | AS/PSAD | `AS_RAPS` |
| No | aVR | PS derecha (posteroseptal) | PST | `PSTA` |
| No | aVL | PL derecha (posterolateral) | DP/DPL | `RP_RPL` |

## Sitios (7, vista OAI 60°)

Tricuspídeo: AS, AL, PL, PS. Mitral: AL, PL, PS. No distingue medioseptal, derecha lateral ni
posteroseptal subepicárdica.

## Puntos a confirmar

1. **Empate** en la delta más positiva entre dos derivaciones de distinta rama (por ejemplo, II y
   aVL iguales): el diagrama no lo contempla. Propuesta: resultado indeterminado.
2. **Transición exactamente en V3:** cuenta como "≤ V3" (sí).
