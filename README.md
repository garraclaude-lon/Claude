# WPW Navigator 3D by Longa

**Prototipo de investigación** del Servicio de Electrofisiología Pediátrica (Hospital Garrahan).
Estima la localización de la vía accesoria en el síndrome de Wolff-Parkinson-White a partir de
criterios del ECG de superficie, aplicando de forma determinista el algoritmo de Arruda (1998).

> ⚠️ No reemplaza la evaluación clínica ni el estudio electrofisiológico. Las reglas deben
> revisarse contra la publicación original antes de cualquier uso asistencial
> (ver [docs/LIMITACIONES.md](docs/LIMITACIONES.md)). No ingresar datos identificables de pacientes.

## Qué hace esta versión (0.4.2)

Al abrir la app se elige una de dos versiones:

1. **Versión simple: desde la imagen del ECG.** Se toma una foto con la cámara del celular o la
   tablet, o se sube un archivo JPG, PNG, BMP o PDF (se usa la primera página). La imagen queda en
   pantalla con zoom y se piden **sexo y edad** del paciente. Opcionalmente, Claude propone una lectura **experimental** de cada criterio.
   Después, la revisión guiada es obligatoria: cada dato se confirma a mano y solo los datos
   confirmados entran al algoritmo. Al final se muestra la concordancia entre la IA y la revisión.
2. **Cuestionario guiado (algoritmo de Arruda).** Pide **sexo y edad** y luego hace una pregunta por vez, en el orden del
   algoritmo, y solo pide los datos que necesita la rama. Desde ahí también se puede abrir el
   formulario completo con todos los criterios juntos.

En los dos casos el resultado muestra la región predicha, el recorrido de decisiones, los
criterios usados, los datos faltantes, la referencia y la versión del algoritmo. Distingue
**región predicha**, **datos insuficientes**, **resultado indeterminado** y **no clasificable**.

### Registro para estadísticas

Al terminar, **"Guardar en el registro"** guarda un registro anónimo (sexo, edad, grupo etario,
criterios confirmados, resultado y concordancia con la IA) en la base de datos privada de la
página publicada en claude.ai. La pantalla de inicio muestra un resumen en vivo por sexo, grupo
etario y región. **La imagen nunca se guarda.**

Cada análisis guardado recibe un **código** (`WPW-XXXXXX`) para anotar en la historia clínica.
La **localización confirmada en el estudio electrofisiológico** se carga al guardar o más tarde,
desde la pantalla de inicio (lista de pendientes o búsqueda por código). La app indica si la
predicción de Arruda coincide con el sitio confirmado y muestra el porcentaje de coincidencia. Formato y cortes etarios: [docs/REGISTRO.md](docs/REGISTRO.md).
En local (`npm run dev`) no hay base de datos y la app lo indica.

El corazón 3D queda para versiones futuras.

### Lectura automática con IA

- Solo funciona en la versión publicada en claude.ai: usa la cuenta de Claude de quien la abre,
  con su permiso. Al ejecutarla en local (`npm run dev`) la app lo indica y sigue sin IA.
- Antes de enviar la imagen hay que confirmar que no contiene datos identificables.
- La respuesta se valida: cualquier valor fuera de las opciones permitidas se descarta.

## Cómo ejecutarla

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev      # abre http://127.0.0.1:5173
npm test         # pruebas automatizadas (Vitest)
npm run build    # compilación de producción en dist/
npm run build:artefacto  # página única para publicar en claude.ai (dist-artefacto/)
```

## Estructura

```
src/
  algoritmo/          # lógica clínica, sin React (se prueba por separado)
    tipos.ts          # tipos de entrada y resultado
    catalogo.ts       # regiones, nombres, referencia y versión
    arruda.ts         # pasos 1–4 y función aplicarArruda()
  ia/lectorIA.ts      # lectura experimental con Claude y validación de su respuesta
  registro/
    paciente.ts       # sexo, edad, grupo etario y validación
    registro.ts       # formato del registro, resumen y conexión con la base de datos
    eef.ts            # sitios del EEF, concordancia con Arruda y códigos de registro
  imagen/preparar.ts  # abre JPG/PNG/BMP/PDF en el navegador
  componentes/        # interfaz React
    PantallaInicio.tsx      # elección de versión
    ModoImagen.tsx          # cámara / archivo + propuesta de la IA
    Asistente.tsx           # cuestionario guiado paso a paso
    VisorECG.tsx            # imagen con zoom
    FormularioECG.tsx       # formulario completo
    FormularioPaciente.tsx  # sexo y edad
    DiagramaAnillos.tsx     # esquema de los anillos AV (región predicha y sitio del EEF)
    Iconos.tsx              # marca e íconos de línea
    GuardarRegistro.tsx, ResumenRegistro.tsx
    SelectorEEF.tsx, CargarEEF.tsx  # localización confirmada en el EEF
    PanelResultado.tsx
    campos.ts               # definición de cada criterio
  App.tsx, main.tsx, estilos.css
  tests/
    arruda.test.ts    # ramas del algoritmo + prueba exhaustiva de 62 500 combinaciones
    App.test.tsx, Asistente.test.tsx, ModoImagen.test.tsx  # interfaz
    lectorIA.test.ts  # validación de la respuesta de la IA y tipos de archivo
    registro.test.ts, GuardarRegistro.test.tsx  # edad, grupos etarios, registro y guardado
docs/
  ALGORITMO.md        # reglas implementadas
  REGISTRO.md         # formato de los datos guardados
  LIMITACIONES.md     # limitaciones y puntos a revisar
```
