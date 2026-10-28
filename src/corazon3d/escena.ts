/**
 * Corazón 3D ESQUEMÁTICO (no anatómico ni del paciente) con el sistema de
 * conducción y la ubicación estimada de la vía accesoria.
 *
 * Coordenadas del corazón: plano de los anillos AV en y = 0, aurículas arriba
 * (y > 0), ventrículos abajo; +x = izquierda del paciente, +z = anterior.
 * Las posiciones de las regiones en los anillos usan los mismos ángulos que
 * el esquema 2D (DiagramaAnillos), para que ambos marquen el mismo lugar.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { REGIONES } from '../algoritmo/catalogo';
import type { CodigoRegion } from '../algoritmo/tipos';
import { SEGMENTOS, type Anillo } from '../componentes/DiagramaAnillos';

export interface OpcionesEscena {
  regiones: CodigoRegion[];
  /** Arranca en pausa (preferencia del sistema de reducir movimiento). */
  pausado: boolean;
  oscuro: boolean;
}

export interface ControlEscena {
  pausar(p: boolean): void;
  velocidad(factor: number): void;
  vista(v: 'frontal' | 'anillos'): void;
  destruir(): void;
}

// --- Geometría base ----------------------------------------------------------

const TA = { c: new THREE.Vector3(-1.0, 0, 0.15), r: 0.8 };
const MA = { c: new THREE.Vector3(0.95, 0, -0.15), r: 0.75 };
const RADIO_SC = MA.r + 0.28;

/** Punto sobre un anillo: ángulo 0 = anterior, sentido horario visto en OAI. */
function puntoAnillo(anillo: Anillo, angulo: number, dr = 0, y = 0): THREE.Vector3 {
  const base = anillo === 't' ? TA : MA;
  const r = (anillo === 'sc' ? RADIO_SC : base.r) + dr;
  const a = THREE.MathUtils.degToRad(angulo);
  return new THREE.Vector3(base.c.x + r * Math.sin(a), y, base.c.z + r * Math.cos(a));
}

/** Ubicación del LED para cada región predicha. */
export function ubicacionRegion(c: CodigoRegion): THREE.Vector3 {
  const s = SEGMENTOS[c]?.[0];
  if (!s) return new THREE.Vector3();
  const medio = (s.desde + s.hasta) / 2;
  if (s.anillo === 'sc') return puntoAnillo('sc', medio, 0, -0.12);
  return puntoAnillo(s.anillo, medio, 0.02, 0);
}

function perfilVentriculo(radio: number, alto: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24; // 0 = punta, 1 = base
    const r = radio * Math.sin((Math.PI / 2) * Math.pow(t, 0.62)) * (1 - 0.12 * t * t);
    pts.push(new THREE.Vector2(Math.max(r, 0.001), -alto * (1 - t)));
  }
  return pts;
}

function texturaBrillo(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Sistema de conducción ---------------------------------------------------

interface Tramo {
  nombre: string;
  puntos: [number, number, number][];
  /** Ventana de activación dentro del ciclo (0–1). */
  inicio: number;
  fin: number;
  grosor: number;
}

const SA: [number, number, number] = [-0.85, 1.75, 0.35];
const AV: [number, number, number] = [-0.32, 0.16, -0.22];
const BIF: [number, number, number] = [0.0, -0.62, 0.05];
const PUNTA_VI: [number, number, number] = [0.78, -2.82, 0.12];
const PUNTA_VD: [number, number, number] = [-0.6, -2.2, 0.42];

const TRAMOS: Tramo[] = [
  { nombre: 'internodal-anterior', puntos: [SA, [-0.55, 1.25, 0.75], [-0.3, 0.6, 0.35], AV], inicio: 0, fin: 0.09, grosor: 0.018 },
  { nombre: 'internodal-medio', puntos: [SA, [-1.2, 1.0, 0.25], [-0.75, 0.45, -0.05], AV], inicio: 0, fin: 0.09, grosor: 0.018 },
  { nombre: 'internodal-posterior', puntos: [SA, [-1.25, 1.15, -0.35], [-0.8, 0.35, -0.55], AV], inicio: 0, fin: 0.09, grosor: 0.018 },
  { nombre: 'bachmann', puntos: [SA, [-0.2, 1.55, 0.2], [0.6, 1.3, -0.2]], inicio: 0.01, fin: 0.08, grosor: 0.016 },
  { nombre: 'his', puntos: [AV, [-0.1, -0.2, -0.05], BIF], inicio: 0.17, fin: 0.2, grosor: 0.04 },
  { nombre: 'rama-derecha', puntos: [BIF, [-0.15, -1.35, 0.25], [-0.42, -1.95, 0.38], PUNTA_VD], inicio: 0.2, fin: 0.255, grosor: 0.028 },
  { nombre: 'rama-izquierda', puntos: [BIF, [0.18, -1.25, -0.05], [0.48, -2.15, 0.08], PUNTA_VI], inicio: 0.2, fin: 0.255, grosor: 0.03 },
  { nombre: 'purkinje-vi-lateral', puntos: [PUNTA_VI, [1.5, -1.7, 0.25], [1.78, -0.55, 0.1]], inicio: 0.255, fin: 0.32, grosor: 0.014 },
  { nombre: 'purkinje-vi-posterior', puntos: [PUNTA_VI, [1.15, -1.8, -0.7], [1.25, -0.6, -0.85]], inicio: 0.255, fin: 0.32, grosor: 0.014 },
  { nombre: 'purkinje-vi-anterior', puntos: [PUNTA_VI, [0.55, -1.7, 0.8], [0.7, -0.55, 0.85]], inicio: 0.255, fin: 0.32, grosor: 0.014 },
  { nombre: 'purkinje-vd-lateral', puntos: [PUNTA_VD, [-1.4, -1.4, 0.6], [-1.75, -0.45, 0.5]], inicio: 0.255, fin: 0.32, grosor: 0.014 },
  { nombre: 'purkinje-vd-anterior', puntos: [PUNTA_VD, [-1.05, -1.55, 0.95], [-1.15, -0.5, 1.05]], inicio: 0.255, fin: 0.32, grosor: 0.014 },
];

/** Ciclo de 0,7 s (≈ 86 lpm) a velocidad normal. */
const PERIODO = 0.7;
const VIA_INICIO = 0.065;
const VIA_FIN = 0.1;

const suave = (x: number) => x * x * (3 - 2 * x);
const ventana = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
/** Pulso que sube en [a, b] y se apaga durante `cola` después. */
function pulso(t: number, a: number, b: number, cola = 0.12): number {
  if (t < a) return 0;
  if (t <= b) return 1;
  return Math.max(0, 1 - (t - b) / cola);
}

// --- Escena --------------------------------------------------------------------

export function crearEscena(contenedor: HTMLElement, opciones: OpcionesEscena): ControlEscena {
  const ancho = () => contenedor.clientWidth || 600;
  const alto = () => contenedor.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(ancho(), alto());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  contenedor.appendChild(renderer.domElement);

  const etiquetas = new CSS2DRenderer();
  etiquetas.setSize(ancho(), alto());
  etiquetas.domElement.className = 'c3d-etiquetas';
  contenedor.appendChild(etiquetas.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(34, ancho() / alto(), 0.1, 100);

  escena.add(new THREE.AmbientLight(0xffffff, opciones.oscuro ? 0.55 : 0.8));
  const luz = new THREE.DirectionalLight(0xffffff, 1.1);
  luz.position.set(3, 5, 6);
  escena.add(luz);
  const contraluz = new THREE.DirectionalLight(0x9fc3ff, 0.5);
  contraluz.position.set(-4, -2, -5);
  escena.add(contraluz);

  const corazon = new THREE.Group();
  escena.add(corazon);

  const brillo = texturaBrillo();
  const desechables: { dispose(): void }[] = [brillo];
  const registrar = <T extends { dispose(): void }>(o: T) => (desechables.push(o), o);

  // Cámaras cardíacas (semitransparentes)
  const tejido = (color: number, opacidad: number) =>
    registrar(
      new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: opacidad,
        roughness: 0.45,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        emissive: new THREE.Color(color).multiplyScalar(0.15),
      }),
    );
  const matVentriculo = tejido(0xd9534f, 0.2);
  const matAuricula = tejido(0xe8897a, 0.16);

  const ventriculos = new THREE.Group();
  const vi = new THREE.Mesh(registrar(new THREE.LatheGeometry(perfilVentriculo(1.02, 3.0), 48)), matVentriculo);
  vi.position.set(MA.c.x - 0.1, 0, MA.c.z);
  vi.rotation.z = 0.08;
  const vd = new THREE.Mesh(registrar(new THREE.LatheGeometry(perfilVentriculo(0.95, 2.35), 48)), matVentriculo);
  vd.position.set(TA.c.x + 0.05, 0, TA.c.z + 0.2);
  vd.scale.set(1.1, 1, 0.9);
  vd.rotation.z = -0.12;
  ventriculos.add(vi, vd);
  corazon.add(ventriculos);

  const auriculas = new THREE.Group();
  const geoAuricula = registrar(new THREE.SphereGeometry(1, 40, 28));
  const ad = new THREE.Mesh(geoAuricula, matAuricula);
  ad.position.set(-1.1, 0.85, 0.1);
  ad.scale.set(0.9, 0.95, 0.85);
  const ai = new THREE.Mesh(geoAuricula, matAuricula);
  ai.position.set(0.85, 0.82, -0.45);
  ai.scale.set(0.85, 0.8, 0.8);
  const vcs = new THREE.Mesh(registrar(new THREE.CylinderGeometry(0.28, 0.3, 1.1, 24, 1, true)), matAuricula);
  vcs.position.set(-0.95, 1.95, 0.1);
  auriculas.add(ad, ai, vcs);
  corazon.add(auriculas);

  // Grandes vasos (muy tenues, como referencia)
  const matVaso = tejido(0xc76b6b, 0.1);
  const vaso = (pts: [number, number, number][], radio: number) =>
    new THREE.Mesh(registrar(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), 40, radio, 20, false)), matVaso);
  corazon.add(
    vaso([[0.3, 0.05, 0.3], [0.25, 1.2, 0.35], [0.45, 2.15, 0.1], [1.05, 2.2, -0.45], [1.25, 1.2, -0.95]], 0.3),
    vaso([[-0.25, 0.1, 0.85], [-0.05, 1.1, 0.95], [0.35, 1.7, 0.75]], 0.27),
  );

  // Anillos AV y seno coronario
  const matAnillo = registrar(new THREE.MeshStandardMaterial({ color: opciones.oscuro ? 0xc9d2dc : 0x8e98a3, transparent: true, opacity: 0.55, roughness: 0.6 }));
  for (const a of [TA, MA]) {
    const anillo = new THREE.Mesh(registrar(new THREE.TorusGeometry(a.r, 0.05, 12, 96)), matAnillo);
    anillo.rotation.x = Math.PI / 2;
    anillo.position.copy(a.c);
    corazon.add(anillo);
  }
  const puntosSC: THREE.Vector3[] = [];
  for (let ang = 150; ang <= 232; ang += 4) puntosSC.push(puntoAnillo('sc', ang, 0, -0.12));
  const sc = new THREE.Mesh(
    registrar(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntosSC), 40, 0.06, 10, false)),
    registrar(new THREE.MeshStandardMaterial({ color: 0x6f8fb3, transparent: true, opacity: 0.45 })),
  );
  corazon.add(sc);

  // Sistema de conducción
  const colorReposo = new THREE.Color(opciones.oscuro ? 0x8a7a2e : 0xb8952a);
  const colorActivo = new THREE.Color(0xfff3a0);
  const tramos = TRAMOS.map((t) => {
    const curva = new THREE.CatmullRomCurve3(t.puntos.map((p) => new THREE.Vector3(...p)));
    const material = registrar(new THREE.MeshBasicMaterial({ color: colorReposo.clone(), transparent: true, opacity: 0.85 }));
    const malla = new THREE.Mesh(registrar(new THREE.TubeGeometry(curva, 48, t.grosor, 8, false)), material);
    corazon.add(malla);
    const chispa = new THREE.Sprite(
      registrar(new THREE.SpriteMaterial({ map: brillo, color: 0xffe27a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })),
    );
    chispa.scale.setScalar(0.28);
    corazon.add(chispa);
    return { ...t, curva, material, chispa };
  });

  const nodo = (pos: [number, number, number], radio: number) => {
    const m = new THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>(
      registrar(new THREE.SphereGeometry(radio, 20, 14)),
      registrar(new THREE.MeshBasicMaterial({ color: colorReposo.clone() })),
    );
    m.position.set(...pos);
    const halo = new THREE.Sprite(
      registrar(new THREE.SpriteMaterial({ map: brillo, color: 0xffd34d, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })),
    );
    halo.scale.setScalar(radio * 9);
    m.add(halo);
    corazon.add(m);
    return { malla: m, halo };
  };
  const nodoSA = nodo(SA, 0.09);
  const nodoAV = nodo(AV, 0.08);

  // Vía accesoria: LED rojo en cada región predicha
  const leds = opciones.regiones
    .filter((c) => SEGMENTOS[c])
    .map((c) => {
      const p = ubicacionRegion(c);
      const grupo = new THREE.Group();
      grupo.position.copy(p);
      const led = new THREE.Mesh(registrar(new THREE.SphereGeometry(0.1, 24, 16)), registrar(new THREE.MeshBasicMaterial({ color: 0xff2a2a })));
      const halo = new THREE.Sprite(
        registrar(new THREE.SpriteMaterial({ map: brillo, color: 0xff2020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })),
      );
      halo.scale.setScalar(0.9);
      const luzLed = new THREE.PointLight(0xff2a2a, 2.2, 3.2, 1.6);
      // Haz que cruza el anillo (aurícula → ventrículo): la preexcitación.
      const cruce = new THREE.Sprite(
        registrar(new THREE.SpriteMaterial({ map: brillo, color: 0xff6b5a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })),
      );
      cruce.scale.setScalar(0.35);
      grupo.add(led, halo, luzLed, cruce);
      const div = document.createElement('div');
      div.className = 'c3d-etiqueta c3d-etiqueta-via';
      div.textContent = `Vía accesoria · ${REGIONES[c].abreviatura}`;
      const etiqueta = new CSS2DObject(div);
      etiqueta.position.set(0, 0.42, 0);
      grupo.add(etiqueta);
      corazon.add(grupo);
      return { halo, luzLed, cruce, led };
    });

  // Etiquetas del sistema de conducción
  const etiquetasConduccion: HTMLElement[] = [];
  const etiquetasAnillos: HTMLElement[] = [];
  const rotular = (texto: string, pos: [number, number, number], deConduccion = true) => {
    const div = document.createElement('div');
    div.className = 'c3d-etiqueta';
    (deConduccion ? etiquetasConduccion : etiquetasAnillos).push(div);
    div.textContent = texto;
    const o = new CSS2DObject(div);
    o.position.set(...pos);
    corazon.add(o);
  };
  rotular('Nódulo sinusal', [SA[0] - 0.1, SA[1] + 0.3, SA[2]]);
  rotular('Nódulo AV', [AV[0] - 0.35, AV[1] + 0.25, AV[2]]);
  rotular('Haz de His', [-0.05, -0.35, 0.1]);
  rotular('Rama derecha', [-0.55, -1.6, 0.5]);
  rotular('Rama izquierda', [0.55, -1.85, 0.2]);
  rotular('Purkinje', [1.55, -1.75, 0.35]);
  rotular('Tricúspide', [TA.c.x - TA.r - 0.3, -0.2, TA.c.z + 0.35], false);
  rotular('Mitral', [MA.c.x + MA.r * 0.2, -0.25, MA.c.z - MA.r - 0.3], false);

  // Cámara y controles
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true;
  controles.enablePan = false;
  controles.minDistance = 5;
  controles.maxDistance = 22;
  controles.target.set(0, -0.6, 0);
  // Frontal: eje largo inclinado. Anillos AV: plano AV de frente, anterior arriba,
  // tricúspide a la izquierda y mitral a la derecha (como el esquema 2D en OAI).
  const ROT_FRONTAL = new THREE.Euler(0.18, -0.35, 0.5);
  const ROT_ANILLOS = new THREE.Euler(-Math.PI / 2 + 0.22, 0, 0);
  const rotObjetivo = ROT_FRONTAL.clone();
  let vistaActual: 'frontal' | 'anillos' = 'frontal';
  /** Más lejos en pantallas angostas para que entre todo el corazón. */
  const distancia = (base: number) => base * Math.max(1, 1.2 / (ancho() / alto()));
  const vista = (v: 'frontal' | 'anillos') => {
    vistaActual = v;
    rotObjetivo.copy(v === 'frontal' ? ROT_FRONTAL : ROT_ANILLOS);
    const angosto = ancho() < 520;
    const mostrar = v === 'frontal' && !angosto;
    for (const e of etiquetasConduccion) e.style.visibility = mostrar ? 'visible' : 'hidden';
    for (const e of etiquetasAnillos) e.style.visibility = angosto ? 'hidden' : 'visible';
    camara.position.set(0, 0, distancia(v === 'frontal' ? 9.4 : 8));
    controles.target.set(0, v === 'frontal' ? -0.35 : 0, 0);
    controles.update();
  };
  corazon.rotation.copy(ROT_FRONTAL);
  vista('frontal');

  // Animación
  let pausado = opciones.pausado;
  let factor = 1;
  let fase = 0.3; // instante inicial con el LED visible
  let ultimo = performance.now();
  let cuadro = 0;
  const centroV = new THREE.Vector3(0.1, -1.1, 0.1);
  const centroA = new THREE.Vector3(-0.1, 0.9, -0.15);

  const animar = (ahora: number) => {
    cuadro = requestAnimationFrame(animar);
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    if (!pausado) fase = (fase + (dt * factor) / PERIODO) % 1;
    const t = fase;

    // Giro suave hacia la vista elegida
    const k = 1 - Math.exp(-dt * 7);
    corazon.rotation.x += (rotObjetivo.x - corazon.rotation.x) * k;
    corazon.rotation.y += (rotObjetivo.y - corazon.rotation.y) * k;
    corazon.rotation.z += (rotObjetivo.z - corazon.rotation.z) * k;

    // Nódulos
    const sa = pulso(t, 0, 0.03, 0.1);
    nodoSA.malla.material.color.copy(colorReposo).lerp(colorActivo, sa);
    nodoSA.halo.material.opacity = sa * 0.9;
    const av = t >= 0.09 && t <= 0.17 ? 0.6 + 0.4 * Math.sin(((t - 0.09) / 0.08) * Math.PI) : pulso(t, 0.17, 0.17, 0.08) * 0.6;
    nodoAV.malla.material.color.copy(colorReposo).lerp(colorActivo, av);
    nodoAV.halo.material.opacity = av * 0.85;

    // Tramos: se encienden al pasar el impulso; la chispa recorre el tramo
    for (const tr of tramos) {
      const activo = pulso(t, tr.inicio, tr.fin, 0.1);
      tr.material.color.copy(colorReposo).lerp(colorActivo, activo);
      const avance = ventana(t, tr.inicio, tr.fin);
      const visible = t >= tr.inicio && t <= tr.fin + 0.02;
      tr.chispa.visible = visible;
      if (visible) tr.chispa.position.copy(tr.curva.getPointAt(Math.min(1, avance)));
    }

    // Vía accesoria: LED titilando y un destello que cruza el anillo antes que el His
    for (const l of leds) {
      const latido = 0.75 + 0.25 * Math.sin(ahora / 180);
      l.halo.material.opacity = 0.55 + 0.45 * latido;
      l.halo.scale.setScalar(0.75 + 0.3 * latido);
      l.luzLed.intensity = 1.4 + 1.6 * latido;
      const c = ventana(t, VIA_INICIO, VIA_FIN);
      const enCruce = t >= VIA_INICIO && t <= VIA_FIN + 0.04;
      l.cruce.material.opacity = enCruce ? 1 - Math.max(0, (t - VIA_FIN) / 0.04) : 0;
      l.cruce.position.set(0, 0.45 - 0.9 * c, 0);
    }

    // Latido: sístole auricular y luego ventricular (contracción hacia el centro)
    const sistA = Math.sin(Math.PI * ventana(t, 0.08, 0.24)) * 0.05;
    auriculas.scale.setScalar(1 - sistA);
    auriculas.position.copy(centroA).multiplyScalar(sistA);
    const sistV = suave(ventana(t, 0.27, 0.4)) * (1 - suave(ventana(t, 0.5, 0.72))) * 0.075;
    ventriculos.scale.setScalar(1 - sistV);
    ventriculos.position.copy(centroV).multiplyScalar(sistV);
    matVentriculo.opacity = 0.2 + sistV * 0.8;

    controles.update();
    renderer.render(escena, camara);
    etiquetas.render(escena, camara);
  };
  cuadro = requestAnimationFrame(animar);

  const alCambiarTamano = () => {
    camara.aspect = ancho() / alto();
    camara.updateProjectionMatrix();
    renderer.setSize(ancho(), alto());
    etiquetas.setSize(ancho(), alto());
    vista(vistaActual);
  };
  const observador = new ResizeObserver(alCambiarTamano);
  observador.observe(contenedor);

  return {
    pausar: (p) => {
      pausado = p;
    },
    velocidad: (f) => {
      factor = f;
    },
    vista,
    destruir: () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      controles.dispose();
      for (const d of desechables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      etiquetas.domElement.remove();
    },
  };
}
