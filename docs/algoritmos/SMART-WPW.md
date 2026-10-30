# Algoritmo SMART-WPW (Khalaph et al., Heart Rhythm 2025)

**Referencia:** Khalaph M, Trajkovska N, Didenko M, et al. A novel ECG algorithm for accurate
localization of manifest accessory pathways in both children and adults: SMART-WPW. Heart Rhythm
2025;22(9):e738–e745. DOI 10.1016/j.hrthm.2025.04.058. Acceso abierto (CC BY-NC-ND 4.0).

**Fuente de esta transcripción:** PDF del artículo aportado por el equipo (figura 2: diagrama;
figuras 3 y 4: ECG típico de cada hora; tablas 1 y 2: rendimiento).

**Población:** 260 pacientes con una vía manifiesta única y ablación exitosa (2013–2024), 76 menores
de 18 años (14 ± 3 años). Desarrollo retrospectivo en 110 y validación prospectiva en 150. Mismo
grupo que EASY-WPW. Excluye preexcitación mínima o intermitente, vías múltiples y cardiopatía
estructural. Vista OAI 40°, mapa en reloj de 12 posiciones (igual al criterio horario del servicio,
ver `docs/RELOJ-ANILLOS.md`).

## Pasos (figura 2)

### Paso 1 — Polaridad de la onda delta en V1

| V1 | Anillo |
|---|---|
| Negativa | **Tricuspídeo** → paso 2 |
| Positiva | **Mitral** → paso 2 mitral (cuenta de inferiores) |

Texto del artículo: un **qS en V1** es característico de vías septales derechas (1–5 h); una **r
pequeña seguida de S**, de pared libre derecha (6–12 h). En algunas vías izquierdas posteriores o
laterales, **V1 puede verse isoeléctrica** (conducción por el nodo AV).

### Paso 2 — Polaridad en V3 (solo tricuspídeo)

| V3 | Ubicación |
|---|---|
| Positiva (R prominente) | **Septal** |
| Negativa (S prominente, o r pequeña con S profunda) | **Pared libre** |

### Paso 3 — Cuántas inferiores (II, III, aVF) tienen delta negativa, y cuáles

"Cuanto más negativa la delta, más posterior la vía." El recuadro indica qué derivaciones deben
ser negativas.

| Inferiores negativas | Pared libre derecha | Septal derecha | Mitral |
|---|---|---|---|
| 0 | **A** — anterior (XI–XII) | **AS** — anteroseptal (I–II) | **L** — lateral (I–III) |
| 1 (III) | **LA** — lateral‑anterior (IX–X) | **MS** — medioseptal (III) | **HPL** — posterolateral alta (IV) |
| 2 (III y aVF) | **LP** — lateral‑posterior (VIII) | **MSP** — medioseptal posterior (IV) | **LPL** — posterolateral baja (V) |
| 3 (II, III y aVF) | **P** — posterior (VI–VII) | **PS** — posteroseptal (V) | **P & PS** — posterior y posteroseptal (VI–VII) |

## Patrones de las derivaciones que usa el algoritmo (figuras 3 y 4)

Lectura de los ECG típicos de cada hora en el PDF a 300 ppp. "+" positiva, "−" negativa, "±"
pequeña o isodifásica. Solo se transcriben V1, V3 y las inferiores; las demás derivaciones están
en las figuras del artículo.

| Sector | Hora | V1 | V3 | II | III | aVF |
|---|---|---|---|---|---|---|
| TV A | XI–XII | − | ± | + | ± (pequeña +) | + |
| TV LA | IX–X | − | ± | + | − | + (pequeña) |
| TV LP | VIII | − | − | ± | − | − |
| TV P | VI–VII | − (r pequeña) | − | − | − | − |
| TV PS | V | − | + | − (pequeña) | − | − |
| TV MSP | IV | − | + | ± | − | − |
| TV MS | III | − | + | + | − (pequeña) | ± |
| TV AS | I–II | − (qS) | + | + | + | + |
| MV P & PS | VI–VII | + | + | − (pequeña) | − | − |
| MV LPL | V | ± | + | − | − | − |
| MV HPL | IV | ± | + | + | ± | + (pequeña) |
| MV L | I–III | + | + | + | + | + |

## Rendimiento informado (tabla 1)

| Sitio (horas) | n (todos / < 18 a) | Sensibilidad todos | Sensibilidad < 18 a |
|---|---|---|---|
| TV AS (1–2) | 20 / 6 | 83 % | 100 % |
| TV MS (3) | 8 / 4 | 89 % | 100 % |
| TV MSP (4) | 36 / 8 | 100 % | 100 % |
| TV PS (5) | 25 / 7 | 100 % | 100 % |
| TV P (6–7) | 6 / 3 | 100 % | 100 % |
| TV LP (8) | 4 / 1 | 100 % | — |
| TV LA (9–10) | 9 / 3 | 100 % (VPP 56 %) | 100 % |
| TV A (11–12) | 15 / 6 | 100 % | 100 % |
| MV P/PS (6–7) | 29 / 2 | 100 % | 67 % |
| MV LPL (5) | 22 / 5 | 100 % | 100 % |
| MV HPL (4) | 9 / 4 | 95 % | 83 % |
| MV L (1–3) | 77 / 27 | 90 % | 100 % |

Global: 97 % (253/260); frente a Pambrun 90 % y Arruda 73 %. En menores de 18 años: 97 % frente a
62 % de Arruda (tabla 2: mitral 95 % vs 59 %; tricuspídeo 100 % vs 65 %).

## Decisiones de implementación (a validar con el equipo)

1. **V1 isoeléctrica:** el diagrama solo tiene negativa o positiva. El texto dice que en vías
   izquierdas posteriores o laterales V1 puede verse isoeléctrica; propuesta: tratarla como
   **mitral**.
2. **"Negativa" en las inferiores:** solo cuenta la delta negativa; isoeléctrica no suma.
3. **Combinaciones no previstas** (por ejemplo, solo II negativa, o II y III sin aVF): el diagrama
   no las contempla → resultado **indeterminado**.
4. **V3:** se toma la polaridad predominante del QRS en V3 (R prominente = positiva; S prominente o
   r pequeña con S profunda = negativa), como describe el texto.
5. La predicción es un **sector horario**; se compara directamente con la hora confirmada en el EEF.
