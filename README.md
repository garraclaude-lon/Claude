# WPW Navigator 3D by Longa

**Prototipo de investigación** del Servicio de Electrofisiología Pediátrica (Hospital Garrahan).
Estima la localización de la vía accesoria en el síndrome de Wolff-Parkinson-White a partir de
criterios del ECG de superficie, aplicando de forma determinista el algoritmo de Arruda (1998).

> ⚠️ No reemplaza la evaluación clínica ni el estudio electrofisiológico. Las reglas deben
> revisarse contra la publicación original antes de cualquier uso asistencial
> (ver [docs/LIMITACIONES.md](docs/LIMITACIONES.md)). No ingresar datos identificables de pacientes.

## Qué hace esta versión (MVP)

- Formulario por derivación (I, II, III, aVR, aVF, V1) con la polaridad inicial de la onda delta
  (primeros 20 ms) y las relaciones R/S en V1 y en III.
- Aplica el algoritmo paso a paso y muestra: región predicha, abreviatura y descripción,
  recorrido de decisiones, criterios usados, datos faltantes, referencia y versión.
- Distingue **región predicha**, **datos insuficientes**, **resultado indeterminado** y
  **no clasificable**. Nunca completa un dato faltante ni inventa una localización.
- No guarda datos, no tiene inicio de sesión, base de datos ni nube. El corazón 3D y la carga de
  imágenes de ECG quedan para versiones futuras.

## Cómo ejecutarla

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev      # abre http://127.0.0.1:5173
npm test         # pruebas automatizadas (Vitest)
npm run build    # compilación de producción en dist/
```

## Estructura

```
src/
  algoritmo/          # lógica clínica, sin React (se prueba por separado)
    tipos.ts          # tipos de entrada y resultado
    catalogo.ts       # regiones, nombres, referencia y versión
    arruda.ts         # pasos 1–4 y función aplicarArruda()
  componentes/        # interfaz React
    FormularioECG.tsx
    PanelResultado.tsx
    ExplicacionAlgoritmo.tsx
  App.tsx, main.tsx, estilos.css
  tests/
    arruda.test.ts    # ramas del algoritmo + prueba exhaustiva de 62 500 combinaciones
    App.test.tsx      # pruebas de interfaz
docs/
  ALGORITMO.md        # reglas implementadas
  LIMITACIONES.md     # limitaciones y puntos a revisar
```
