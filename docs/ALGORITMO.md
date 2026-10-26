# Reglas implementadas (versión `arruda-1998-impl-0.1.0`)

Fuente de las reglas: especificación del proyecto, basada en el algoritmo de Arruda et al., 1998.
**No se verificó directamente contra el artículo original** (no está en el repositorio).

Entrada: polaridad de los primeros 20 ms de la onda delta (positiva, negativa, isoeléctrica,
no evaluable) en I, II, aVF, V1 y aVR; R/S en V1 (R > S, R ≤ S, no evaluable); R/S en III
(R > S, R < S, R = S, no evaluable). Cualquier campo puede quedar vacío.

Los pasos se evalúan en orden; el primero que clasifica o se detiene termina el recorrido.

| Paso | Condición | Resultado |
|---|---|---|
| 1 | I negativa/isoeléctrica **o** R > S en V1 | Pared libre izquierda → aVF positiva: **LL/LAL**; aVF negativa/isoeléctrica: **LP/LPL** |
| 1 | I positiva **y** R ≤ S en V1 | continúa al paso 2 |
| 2 | II negativa | **Posteroseptal subepicárdica** |
| 2 | II positiva/isoeléctrica | continúa al paso 3 |
| 3 | V1 negativa/isoeléctrica → aVF negativa | **PSTA/CSOs** |
| 3 | … aVF isoeléctrica | **PSTA o PSMA** (se muestran ambas) |
| 3 | … aVF positiva → R > S en III | **AS/RAPS** |
| 3 | … aVF positiva → R < S en III | **MSTA** |
| 3 | … aVF positiva → R = S o no evaluable en III | indeterminado |
| 3 | V1 positiva | continúa al paso 4 |
| 4 | aVR positiva | **RA/RAL** |
| 4 | aVR negativa/isoeléctrica → II positiva | **RL** |
| 4 | … II isoeléctrica | **RP/RPL** |
| 4 | … II negativa | no clasificable |

## Datos vacíos y "no evaluable"

- **Vacío** → *datos insuficientes*: se indica qué campo completar. Solo se piden los campos de
  la rama recorrida (p. ej., R/S en III solo si V1 es septal y aVF positiva).
- **No evaluable** → *indeterminado*: el dato existe pero las reglas no permiten decidir.
- Paso 1 con lógica "o": basta con un criterio que se cumpla. Para descartarlo hacen falta
  ambos (I positiva y R ≤ S en V1). Si uno no cumple y el otro está vacío → datos insuficientes;
  si el otro es no evaluable → indeterminado.
