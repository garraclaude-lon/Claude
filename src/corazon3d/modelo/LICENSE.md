# Licencia del modelo 3D (corazon.glb, referencias.json)

Estos archivos son una **adaptación** de “Z-Anatomy — The libre 3D atlas of anatomy”
(https://github.com/Z-Anatomy/Models-of-human-anatomy), licenciado bajo
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), que a su vez se basa en
“BodyParts3D, © The Database Center for Life Science” (CC BY 4.0).

Se obtuvieron del paquete `@authorod/svitylo-3d-anatomy-data@1.2.0`, que redistribuye
Z-Anatomy (commit e38ea5e6c7e22d229a975f3fde563a5aca52099e).

**Cambios realizados:** extracción del corazón, válvulas, coronarias, venas cardíacas y grandes
vasos; recorte de las venas cavas; cambio de unidades (cm) y de origen (centro de las cámaras);
simplificación de la malla; cálculo de referencias anatómicas aproximadas (anillos AV, septum,
ostium del seno coronario, nódulos y trayectos del sistema de conducción). Ver
`scripts/extraer-corazon.mjs`.

Por la cláusula *ShareAlike*, estos archivos se distribuyen bajo **CC BY-SA 4.0**. Esta licencia
aplica solo a los datos del modelo, no al resto del código de la aplicación.
