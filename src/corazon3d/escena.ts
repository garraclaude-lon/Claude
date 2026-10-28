/**
 * Corazón 3D a partir de un modelo anatómico (Z-Anatomy, basado en BodyParts3D),
 * con el sistema de conducción trazado sobre la anatomía y un LED en la
 * ubicación estimada de la vía accesoria.
 *
 * El modelo es de un adulto de referencia, no del paciente. Coordenadas del
 * modelo en cm: +y arriba, +z anterior, +x izquierda del paciente.
 * Los anillos AV usan los mismos ángulos que el esquema 2D (DiagramaAnillos):
 * 0° = anterosuperior y 90° = hacia la izquierda del paciente.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { REGIONES } from '../algoritmo/catalogo';
import type { CodigoRegion } from '../algoritmo/tipos';
import { SEGMENTOS } from '../componentes/DiagramaAnillos';
import modeloUrl from './modelo/corazon.glb?url';
import referencias from './modelo/referencias.json';

export interface OpcionesEscena {
  regiones: CodigoRegion[];
  /** Arranca en pausa (preferencia del sistema de reducir movimiento). */
  pausado: boolean;
  oscuro: boolean;
}

export type Vista = 'via' | 'frontal' | 'anillos';

export interface ControlEscena {
  pausar(p: boolean): void;
  velocidad(factor: number): void;
  vista(v: Vista): void;
  destruir(): void;
}

type Vec = [number, number, number];
const v3 = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);

interface Anillo {
  centro: Vec;
  normal: Vec;
  radio: number;
  arriba: Vec;
  derecha: Vec;
}
const ANILLOS = referencias.anillos as unknown as { tricuspide: Anillo; mitral: Anillo };

/** Punto sobre un anillo AV para un ángulo del esquema 2D. */
export function puntoAnillo(cual: 'tricuspide' | 'mitral', angulo: number, dr = 0): THREE.Vector3 {
  const a = ANILLOS[cual];
  const t = THREE.MathUtils.degToRad(angulo);
  return v3(a.centro)
    .add(v3(a.arriba).multiplyScalar((a.radio + dr) * Math.cos(t)))
    .add(v3(a.derecha).multiplyScalar((a.radio + dr) * Math.sin(t)));
}

/** Ubicación del LED para cada región predicha (cm, coordenadas del modelo). */
export function ubicacionRegion(c: CodigoRegion): THREE.Vector3 {
  const s = SEGMENTOS[c]?.[0];
  if (!s) return v3(referencias.centros.ventriculo_izquierdo);
  if (c === 'PS_SUBEPI') return v3(referencias.sitios.subepicardica);
  const medio = (s.desde + s.hasta) / 2;
  const p = puntoAnillo(s.anillo === 't' ? 'tricuspide' : 'mitral', medio);
  // PSTA/CSOs: entre el anillo posteroseptal y el ostium del seno coronario
  if (c === 'PSTA_CSOS') return p.lerp(v3(referencias.sitios.ostium), 0.5);
  return p;
}

// --- Tiempos del ciclo (fracciones de 0 a 1) ------------------------------------

const PERIODO = 0.75; // s, ≈ 80 lpm
interface Tramo {
  nombre: string;
  inicio: number;
  fin: number;
  radio: number;
}
const TRAMOS: Tramo[] = [
  { nombre: 'internodal_anterior', inicio: 0.0, fin: 0.09, radio: 0.07 },
  { nombre: 'internodal_medio', inicio: 0.0, fin: 0.09, radio: 0.07 },
  { nombre: 'internodal_posterior', inicio: 0.0, fin: 0.09, radio: 0.07 },
  { nombre: 'bachmann', inicio: 0.01, fin: 0.08, radio: 0.07 },
  { nombre: 'his', inicio: 0.17, fin: 0.2, radio: 0.16 },
  { nombre: 'rama_derecha', inicio: 0.2, fin: 0.255, radio: 0.11 },
  { nombre: 'rama_izquierda', inicio: 0.2, fin: 0.255, radio: 0.13 },
  ...referencias.purkinje.map((n) => ({ nombre: n, inicio: 0.255, fin: 0.32, radio: 0.055 })),
];
const VIA_INICIO = 0.06;
const VIA_FIN = 0.1;

const suave = (x: number) => x * x * (3 - 2 * x);
const ventana = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const pulso = (t: number, a: number, b: number, cola = 0.12) => (t < a ? 0 : t <= b ? 1 : Math.max(0, 1 - (t - b) / cola));

function texturaBrillo(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fondo(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a2233');
  grad.addColorStop(0.55, '#0c1018');
  grad.addColorStop(1, '#06080c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Materiales por tipo de estructura. */
function material(grupo: string): THREE.MeshPhysicalMaterial {
  const base = {
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
    sheen: 0.35,
    sheenRoughness: 0.5,
    envMapIntensity: 0.55,
  };
  const translucido = (color: number, opacity: number, sheenColor = 0xff9a8a) =>
    new THREE.MeshPhysicalMaterial({
      ...base,
      color,
      sheenColor: new THREE.Color(sheenColor),
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  switch (grupo) {
    case 'ventriculo':
      return translucido(0x9e2626, 0.34);
    case 'auricula':
      return translucido(0xb3423d, 0.3);
    case 'papilar':
      return translucido(0x9c2424, 0.45);
    case 'valvula':
      return new THREE.MeshPhysicalMaterial({ ...base, color: 0xf2d9c9, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    case 'arteria':
      return new THREE.MeshPhysicalMaterial({ ...base, color: 0xd7262c, emissive: new THREE.Color(0x3a0507), clearcoat: 0.9 });
    case 'aorta':
      return translucido(0xc83c3a, 0.42);
    case 'pulmonar':
      return translucido(0x6f7fc4, 0.42, 0xb7c3ff);
    case 'vena':
      return translucido(0x4c62b3, 0.42, 0xa9b8ff);
    case 'vena_cardiaca':
      return new THREE.MeshPhysicalMaterial({ ...base, color: 0x5560c2, emissive: new THREE.Color(0x0b0f2a), clearcoat: 0.9 });
    case 'vena_pulmonar':
      return translucido(0xc25463, 0.38);
    default:
      return translucido(0xb03a3a, 0.35);
  }
}

// --- Escena --------------------------------------------------------------------

export async function crearEscena(contenedor: HTMLElement, opciones: OpcionesEscena): Promise<ControlEscena> {
  const ancho = () => contenedor.clientWidth || 600;
  const alto = () => contenedor.clientHeight || 420;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(ancho(), alto());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  contenedor.appendChild(renderer.domElement);

  const etiquetas = new CSS2DRenderer();
  etiquetas.setSize(ancho(), alto());
  etiquetas.domElement.className = 'c3d-etiquetas';
  contenedor.appendChild(etiquetas.domElement);

  const escena = new THREE.Scene();
  const texFondo = fondo();
  escena.background = texFondo;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambiente = new RoomEnvironment(renderer);
  const envMap = pmrem.fromScene(ambiente, 0.04).texture;
  escena.environment = envMap;
  ambiente.dispose();

  const camara = new THREE.PerspectiveCamera(30, ancho() / alto(), 0.5, 400);
  const luzClave = new THREE.DirectionalLight(0xfff1e8, 2.2);
  luzClave.position.set(25, 40, 45);
  const luzContra = new THREE.DirectionalLight(0x88aaff, 1.2);
  luzContra.position.set(-35, 10, -40);
  escena.add(luzClave, luzContra, new THREE.HemisphereLight(0xffeedd, 0x220a0a, 0.35));

  const desechables: { dispose(): void }[] = [texFondo, envMap, pmrem];
  const registrar = <T extends { dispose(): void }>(o: T) => (desechables.push(o), o);
  const brillo = registrar(texturaBrillo());

  // Pivote: la orientación de las vistas se aplica a este grupo
  const corazon = new THREE.Group();
  escena.add(corazon);

  // --- Modelo anatómico
  const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await cargador.loadAsync(modeloUrl);
  const ventriculos = new THREE.Group();
  const auriculas = new THREE.Group();
  const fijos = new THREE.Group();
  corazon.add(ventriculos, auriculas, fijos);
  const centroV = v3(referencias.centros.ventriculo_izquierdo).lerp(v3(referencias.centros.ventriculo_derecho), 0.5);
  const centroA = v3(referencias.centros.auricula_izquierda).lerp(v3(referencias.centros.auricula_derecha), 0.5);
  const DESTINO: Record<string, THREE.Group> = {
    ventriculo: ventriculos, papilar: ventriculos, arteria: ventriculos, vena_cardiaca: ventriculos,
    auricula: auriculas, vena_pulmonar: auriculas,
  };
  const mallas: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) mallas.push(o as THREE.Mesh);
  });
  for (const m of mallas) {
    const grupo = (m.userData.grupo as string) ?? (m.parent?.userData.grupo as string) ?? 'otro';
    m.geometry.computeVertexNormals();
    m.material = registrar(material(grupo));
    m.renderOrder = grupo === 'ventriculo' || grupo === 'auricula' ? 2 : 1;
    registrar(m.geometry);
    (DESTINO[grupo] ?? fijos).add(m);
  }

  // --- Sistema de conducción sobre la anatomía
  const colorReposo = new THREE.Color(0x9b7a1c);
  const colorActivo = new THREE.Color(0xfff6b0);
  const tramos = TRAMOS.map((t) => {
    const puntos = (referencias.trayectos as Record<string, number[][]>)[t.nombre].map(v3);
    const curva = new THREE.CatmullRomCurve3(puntos);
    const mat = registrar(new THREE.MeshStandardMaterial({ color: 0x5e4a12, emissive: colorReposo.clone(), emissiveIntensity: 0.6, roughness: 0.4 }));
    const tubo = new THREE.Mesh(registrar(new THREE.TubeGeometry(curva, 64, t.radio, 10, false)), mat);
    const chispa = new THREE.Sprite(
      registrar(new THREE.SpriteMaterial({ map: brillo, color: 0xffe07a, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })),
    );
    chispa.scale.setScalar(1.1);
    // Los tramos ventriculares se mueven con los ventrículos; los auriculares con las aurículas.
    const destino = t.inicio >= 0.17 ? ventriculos : auriculas;
    destino.add(tubo, chispa);
    return { ...t, curva, mat, chispa };
  });

  const nodo = (pos: Vec, radio: number, destino: THREE.Group) => {
    const mat = registrar(new THREE.MeshStandardMaterial({ color: 0x5e4a12, emissive: colorReposo.clone(), emissiveIntensity: 1 }));
    const m = new THREE.Mesh(registrar(new THREE.SphereGeometry(radio, 24, 16)), mat);
    m.position.copy(v3(pos));
    const halo = new THREE.Sprite(
      registrar(new THREE.SpriteMaterial({ map: brillo, color: 0xffcf4a, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 })),
    );
    halo.scale.setScalar(radio * 10);
    m.add(halo);
    destino.add(m);
    return { mat, halo };
  };
  const nodoSA = nodo(referencias.nodos.sinusal as Vec, 0.32, auriculas);
  const nodoAV = nodo(referencias.nodos.auriculoventricular as Vec, 0.28, auriculas);

  // --- LED de la vía accesoria
  const leds = opciones.regiones
    .filter((c) => SEGMENTOS[c])
    .map((c) => {
      const g = new THREE.Group();
      g.position.copy(ubicacionRegion(c));
      const led = new THREE.Mesh(
        registrar(new THREE.SphereGeometry(0.5, 32, 20)),
        registrar(new THREE.MeshBasicMaterial({ color: 0xff2a2a, depthTest: false, transparent: true })),
      );
      const halo = new THREE.Sprite(
        registrar(new THREE.SpriteMaterial({ map: brillo, color: 0xff2a1a, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })),
      );
      halo.scale.setScalar(3.6);
      const luz = new THREE.PointLight(0xff2a1a, 6, 6, 2);
      const cruce = new THREE.Sprite(
        registrar(new THREE.SpriteMaterial({ map: brillo, color: 0xff7a5a, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 })),
      );
      cruce.scale.setScalar(1.8);
      led.renderOrder = 10;
      halo.renderOrder = 11;
      g.add(led, halo, luz, cruce);
      // El contenedor lo posiciona CSS2DRenderer; la etiqueta interna se corre hacia arriba en pantalla.
      const div = document.createElement('div');
      const texto = document.createElement('span');
      texto.className = 'c3d-etiqueta c3d-etiqueta-via';
      texto.textContent = `Vía accesoria · ${REGIONES[c].abreviatura}`;
      div.appendChild(texto);
      const et = new CSS2DObject(div);
      et.position.set(0, 0, 0);
      g.add(et);
      corazon.add(g);
      // Dirección del cruce: de la aurícula al ventrículo (normal del anillo)
      const anillo = SEGMENTOS[c]![0].anillo === 'm' ? ANILLOS.mitral : ANILLOS.tricuspide;
      return { halo, luz, cruce, dir: v3(anillo.normal).normalize() };
    });

  // --- Etiquetas
  const etConduccion: HTMLElement[] = [];
  const etAnatomia: HTMLElement[] = [];
  const rotular = (texto: string, pos: THREE.Vector3, lista: HTMLElement[]) => {
    const div = document.createElement('div');
    div.className = 'c3d-etiqueta';
    div.textContent = texto;
    lista.push(div);
    const o = new CSS2DObject(div);
    o.position.copy(pos);
    corazon.add(o);
  };
  const tr = referencias.trayectos as Record<string, number[][]>;
  const medioDe = (n: string) => v3(tr[n][Math.floor(tr[n].length / 2)]);
  rotular('Nódulo sinusal', v3(referencias.nodos.sinusal).add(new THREE.Vector3(-1.2, 1.2, 0)), etConduccion);
  rotular('Nódulo AV', v3(referencias.nodos.auriculoventricular).add(new THREE.Vector3(-1.6, -0.4, 0.6)), etConduccion);
  rotular('Haz de His', medioDe('his').add(new THREE.Vector3(0, 0.9, 0.6)), etConduccion);
  rotular('Rama derecha', medioDe('rama_derecha').add(new THREE.Vector3(-1.3, 0, 0.6)), etConduccion);
  rotular('Rama izquierda', medioDe('rama_izquierda').add(new THREE.Vector3(1.4, 0, 0.4)), etConduccion);
  rotular('Purkinje', medioDe('purkinje_vi_0').add(new THREE.Vector3(1.2, 0, 0)), etConduccion);
  rotular('Tricúspide', puntoAnillo('tricuspide', 270, 1.2), etAnatomia);
  rotular('Mitral', puntoAnillo('mitral', 120, 1.4), etAnatomia);

  // --- Postproceso: resplandor de lo luminoso
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(ancho(), alto());
  composer.addPass(new RenderPass(escena, camara));
  const bloom = new UnrealBloomPass(new THREE.Vector2(ancho(), alto()), 0.5, 0.4, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  desechables.push(composer, bloom);

  // --- Vistas
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true;
  controles.enablePan = false;
  controles.rotateSpeed = 0.9;
  controles.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controles.minDistance = 18;
  controles.maxDistance = 90;

  const QUAT_FRONTAL = new THREE.Quaternion();
  // Anillos AV de frente: eje "derecha" a la derecha de la pantalla y "arriba" hacia arriba,
  // igual que el esquema 2D (tricúspide a la izquierda, mitral a la derecha).
  const QUAT_ANILLOS = (() => {
    const der = v3(ANILLOS.tricuspide.derecha).add(v3(ANILLOS.mitral.derecha)).normalize();
    const arr = v3(ANILLOS.tricuspide.arriba).add(v3(ANILLOS.mitral.arriba));
    arr.sub(der.clone().multiplyScalar(arr.dot(der))).normalize();
    const haciaCamara = new THREE.Vector3().crossVectors(der, arr).normalize();
    const m = new THREE.Matrix4().makeBasis(der, arr, haciaCamara);
    return new THREE.Quaternion().setFromRotationMatrix(m).invert();
  })();
  const centroAnillos = v3(ANILLOS.tricuspide.centro).lerp(v3(ANILLOS.mitral.centro), 0.5);
  // Vía accesoria de frente: gira el corazón para que el LED mire a la cámara, sin dar vuelta arriba/abajo.
  const centroCamaras = centroV.clone().lerp(centroA, 0.5);
  const QUAT_VIA = (() => {
    const pts = opciones.regiones.filter((c) => SEGMENTOS[c]).map(ubicacionRegion);
    if (!pts.length) return QUAT_FRONTAL.clone();
    const objetivo = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const dir = objetivo.sub(centroCamaras);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) return QUAT_FRONTAL.clone();
    const ang = Math.atan2(dir.x, dir.z); // giro sobre el eje vertical
    // Se deja un poco de oblicuidad para conservar la sensación de volumen.
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang * 0.85);
  })();
  const quatObjetivo = QUAT_VIA.clone();
  const pivoteObjetivo = new THREE.Vector3();
  let vistaActual: Vista = 'via';
  const distancia = (base: number) => base * Math.max(1, 1.0 / (ancho() / alto()));

  const vista = (v: Vista) => {
    vistaActual = v;
    quatObjetivo.copy(v === 'frontal' ? QUAT_FRONTAL : v === 'via' ? QUAT_VIA : QUAT_ANILLOS);
    pivoteObjetivo.copy(v === 'anillos' ? centroAnillos : new THREE.Vector3(0, 1.6, 0));
    const cerca = ancho() < 520 ? 0.84 : 1; // en el celular el corazón se ve más grande
    camara.position.set(0, 0, distancia(v === 'anillos' ? 30 : 37) * cerca);
    controles.target.set(0, 0, 0);
    controles.update();
    const angosto = ancho() < 520;
    for (const e of etConduccion) e.style.visibility = v === 'frontal' && !angosto ? 'visible' : 'hidden';
    for (const e of etAnatomia) e.style.visibility = angosto ? 'hidden' : 'visible';
  };
  corazon.quaternion.copy(QUAT_VIA);
  vista('via');

  // --- Animación
  let pausado = opciones.pausado;
  let factor = 1;
  let fase = 0.32;
  let ultimo = performance.now();
  let cuadro = 0;
  const pivoteActual = new THREE.Vector3(0, 1.6, 0);
  const desplazado = new THREE.Vector3();

  const animar = (ahora: number) => {
    cuadro = requestAnimationFrame(animar);
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    if (!pausado) fase = (fase + (dt * factor) / PERIODO) % 1;
    const t = fase;

    // Giro suave hacia la vista elegida (el corazón rota alrededor del pivote)
    const k = 1 - Math.exp(-dt * 6);
    corazon.quaternion.slerp(quatObjetivo, k);
    pivoteActual.lerp(pivoteObjetivo, k);
    corazon.position.copy(desplazado.copy(pivoteActual).applyQuaternion(corazon.quaternion).multiplyScalar(-1));

    // Nódulos
    const sa = pulso(t, 0, 0.03, 0.12);
    nodoSA.mat.emissive.copy(colorReposo).lerp(colorActivo, sa);
    nodoSA.mat.emissiveIntensity = 0.7 + sa * 1.8;
    nodoSA.halo.material.opacity = sa;
    const av = t >= 0.09 && t <= 0.17 ? 0.55 + 0.45 * Math.sin(((t - 0.09) / 0.08) * Math.PI) : 0;
    nodoAV.mat.emissive.copy(colorReposo).lerp(colorActivo, av);
    nodoAV.mat.emissiveIntensity = 0.7 + av * 1.6;
    nodoAV.halo.material.opacity = av;

    for (const tr of tramos) {
      const a = pulso(t, tr.inicio, tr.fin, 0.12);
      tr.mat.emissive.copy(colorReposo).lerp(colorActivo, a);
      tr.mat.emissiveIntensity = 0.6 + a * 1.8;
      const visible = t >= tr.inicio && t <= tr.fin + 0.015;
      tr.chispa.visible = visible;
      if (visible) tr.chispa.position.copy(tr.curva.getPointAt(ventana(t, tr.inicio, tr.fin)));
    }

    for (const l of leds) {
      const latido = 0.5 + 0.5 * Math.sin(ahora / 170);
      l.halo.material.opacity = 0.75 + 0.25 * latido;
      l.halo.scale.setScalar(3 + 1.6 * latido);
      l.luz.intensity = 4 + 6 * latido;
      const c = ventana(t, VIA_INICIO, VIA_FIN);
      const enCruce = t >= VIA_INICIO && t <= VIA_FIN + 0.04;
      l.cruce.material.opacity = enCruce ? 1 - Math.max(0, (t - VIA_FIN) / 0.04) : 0;
      l.cruce.position.copy(l.dir).multiplyScalar(-1.6 + 3.2 * c);
    }

    // Latido: sístole auricular y ventricular, cada una hacia su propio centro
    const sistA = Math.sin(Math.PI * ventana(t, 0.08, 0.24)) * 0.04;
    auriculas.scale.setScalar(1 - sistA);
    auriculas.position.copy(centroA).multiplyScalar(sistA);
    const sistV = suave(ventana(t, 0.27, 0.4)) * (1 - suave(ventana(t, 0.5, 0.74))) * 0.065;
    ventriculos.scale.setScalar(1 - sistV);
    ventriculos.position.copy(centroV).multiplyScalar(sistV);

    controles.update();
    composer.render();
    etiquetas.render(escena, camara);
  };
  cuadro = requestAnimationFrame(animar);

  const alCambiarTamano = () => {
    camara.aspect = ancho() / alto();
    camara.updateProjectionMatrix();
    renderer.setSize(ancho(), alto());
    composer.setSize(ancho(), alto());
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
