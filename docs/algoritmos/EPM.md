# Algoritmo EPM (de Alencar Neto et al., 2024)

**Referencia:** de Alencar Neto JN, et al. EPM algorithm: A stepwise approach to accessory pathway
localization in ventricular pre-excitation. J Electrocardiol. 2024;84:1–8.
DOI 10.1016/j.jelectrocard.2024.02.007.

**Fuente de esta transcripción:** diagrama de flujo aportado por el equipo (figura "Algoritmo EPM
para pré-excitação ventricular"). Pendiente de cotejar con el texto completo del artículo.

## Pasos

El nombre viene de los tres pasos: **E** (esquerda, izquierda), **P** (posterior) y **M** (migración).

### Paso E — ¿Vía izquierda?

Se cuentan cuántos de estos criterios se cumplen:

1. Onda delta **negativa en DI o en aVL**.
2. **R > S en V1**.

### Paso P — ¿Posterior o anterior?

Polaridad de la onda delta en **DIII**.

| Criterios del paso E | Delta en DIII | Resultado |
|---|---|---|
| 0 | negativa | Posterior → paso M |
| 0 | positiva | Anterior → paso M |
| 1 | negativa | **PSE** (posteroseptal izquierda) |
| 1 | positiva | **ALE** (anterolateral izquierda) |
| 2 | negativa | **PLE** (posterolateral izquierda) |
| 2 | positiva | **ALE** (anterolateral izquierda) |

### Paso M — Migración en precordiales (solo vías derechas)

| Desde | Migra hasta V3 | Migra después de V3 |
|---|---|---|
| Posterior | **PSD** (posteroseptal derecha) | **PLD** (posterolateral derecha) |
| Anterior | **ASD** (anteroseptal derecha) | **ALD** (anterolateral derecha) |

## Regiones (7) y equivalencias con la app

| EPM (portugués) | Nombre | Sigla en la app | Código interno |
|---|---|---|---|
| ALE | Anterolateral izquierda | IL/IAL | `LL_LAL` |
| PLE | Posterolateral izquierda | IP/IPL | `LP_LPL` |
| PSE | Posteroseptal izquierda | PSM | `PSMA` |
| PSD | Posteroseptal derecha | PST | `PSTA` |
| ASD | Anteroseptal derecha | AS/PSAD | `AS_RAPS` |
| ALD | Anterolateral derecha | DA/DAL | `RA_RAL` |
| PLD | Posterolateral derecha | DP/DPL | `RP_RPL` |

EPM no distingue vía medioseptal (MST), derecha lateral (DL) ni posteroseptal subepicárdica.

## Puntos a confirmar con el equipo

1. **"Migra até V3 / após V3":** se interpreta como la **transición precordial** (la derivación
   donde R pasa a ser mayor que S) en V3 o antes, frente a después de V3. A confirmar si se refiere
   a la transición del QRS o al cambio de polaridad de la onda delta.
2. **Delta isoeléctrica** (en DI, aVL o DIII): el diagrama solo contempla negativa o positiva.
   Hay que definir cómo se trata.
