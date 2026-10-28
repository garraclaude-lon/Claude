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
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { REGIONES } from '../algoritmo/catalogo';
import type { CodigoRegion } from '../algoritmo/tipos';
import { SEGMENTOS } from '../componentes/DiagramaAnillos';
// El modelo va embebido como texto base64 y se decodifica acá mismo: el visor de claude.ai
// no permite cargar datos con fetch (tampoco desde una URL data:).
import modeloBase64 from './modelo/corazon.glb?base64';
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
  /** Muestra u oculta las referencias anatómicas: etiquetas, válvulas AV, papilares y cuerdas (la etiqueta de la vía siempre queda). */
  etiquetas(visibles: boolean): void;
  /** Muestra u oculta los vasos coronarios (arterias y venas cardíacas). */
  coronarias(visibles: boolean): void;
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

/** Convierte el modelo en base64 (o una URL data: en base64) en bytes, sin usar fetch. */
export function decodificarModelo(texto: string): ArrayBuffer {
  const b64 = texto.startsWith('data:') ? texto.slice(texto.indexOf(',') + 1) : texto;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
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
  // Rama derecha: fina y larga (llega a la banda moderadora)
  { nombre: 'rama_derecha', inicio: 0.2, fin: 0.255, radio: 0.08 },
  // Rama izquierda: tronco corto y ancho que se divide en dos hemirramas
  { nombre: 'rama_izquierda', inicio: 0.2, fin: 0.215, radio: 0.15 },
  { nombre: 'hemirrama_anterior', inicio: 0.215, fin: 0.255, radio: 0.085 },
  { nombre: 'hemirrama_posterior', inicio: 0.215, fin: 0.25, radio: 0.11 },
  ...referencias.purkinje.map((n) => ({ nombre: n, inicio: 0.255, fin: 0.32, radio: 0.05 })),
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
  // Primero el modelo: si falla, todavía no se agregó nada a la página.
  const gltf = await new GLTFLoader().parseAsync(decodificarModelo(modeloBase64), '');
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

  const capaGuia = document.createElement('div');
  capaGuia.className = 'c3d-guia';
  const svgGuia = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgGuia.setAttribute('aria-hidden', 'true');
  capaGuia.appendChild(svgGuia);

  const etiquetas = new CSS2DRenderer();
  etiquetas.setSize(ancho(), alto());
  etiquetas.domElement.className = 'c3d-etiquetas';
  contenedor.appendChild(etiquetas.domElement);
  contenedor.appendChild(capaGuia);

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
  const coronarias: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) mallas.push(o as THREE.Mesh);
  });
  for (const m of mallas) {
    const grupo = (m.userData.grupo as string) ?? (m.parent?.userData.grupo as string) ?? 'otro';
    m.geometry.computeVertexNormals();
    m.material = registrar(material(grupo));
    m.renderOrder = grupo === 'ventriculo' || grupo === 'auricula' ? 2 : 1;
    // Vasos coronarios: arterias y venas cardíacas (incluye el seno coronario)
    if (grupo === 'arteria' || grupo === 'vena_cardiaca') {
      coronarias.push(m);
      m.visible = false; // apagados por defecto
    }
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
    chispa.scale.setScalar(0.75);
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

  // --- Válvulas AV minimalistas, papilares y cuerdas tendinosas (esquemáticos)
  // Aparato valvular (válvulas, papilares, cuerdas y anillos): oculto hasta prender las referencias.
  const aparatoValvular = new THREE.Group();
  aparatoValvular.visible = false;
  ventriculos.add(aparatoValvular);
  // Estilo minimalista: velo casi transparente y solo el borde libre marcado (sin brillo).
  const matValva = registrar(new THREE.MeshStandardMaterial({
    color: 0xd9bfb2, roughness: 0.85, metalness: 0, envMapIntensity: 0.2,
    transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
  }));
  const matBorde = registrar(new THREE.LineBasicMaterial({ color: 0xd6bdb0, transparent: true, opacity: 0.9, depthWrite: false }));
  const matAnillo = registrar(new THREE.MeshStandardMaterial({ color: 0xb89c90, roughness: 0.7, envMapIntensity: 0.3, transparent: true, opacity: 0.55, depthWrite: false }));
  const matPapilar = registrar(new THREE.MeshPhysicalMaterial({
    color: 0xb3473f, roughness: 0.45, clearcoat: 0.4, sheen: 0.3, sheenColor: new THREE.Color(0xff9a8a),
    transparent: true, opacity: 0.7, depthWrite: false,
  }));
  const matCuerda = registrar(new THREE.LineBasicMaterial({ color: 0xc9b0a4, transparent: true, opacity: 0.35, depthWrite: false }));
  const valvas = crearValvas();
  const cuerdas = crearPapilaresYCuerdas();

  function crearValvas() {
    const U = 18, W = 6;
    const indices: number[] = [];
    for (let i = 0; i < U; i++)
      for (let j = 0; j < W; j++) {
        const a = i * (W + 1) + j, b = a + W + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const dir = (an: Anillo, g: number, out: THREE.Vector3) => {
      const t = THREE.MathUtils.degToRad(g);
      return out.copy(v3(an.arriba)).multiplyScalar(Math.cos(t)).addScaledVector(v3(an.derecha), Math.sin(t));
    };
    type Def = { anillo: Anillo; a0: number; a1: number; largo: number; borde: (u: number) => number[] };
    const defs: Def[] = [];
    // Tricúspide: tres valvas (septal, anterior y posterior) que cierran en forma de "Y"
    const T = ANILLOS.tricuspide;
    const s0 = referencias.valvas.tricuspideSeptal - 55, s1 = referencias.valvas.tricuspideSeptal + 55;
    const restoA: [number, number] = [s1, s1 + 110]; // posterior o anterior según el lado
    const restoB: [number, number] = [s1 + 110, s0 + 360];
    const cercaDe0 = (r: [number, number]) => Math.abs(Math.cos(THREE.MathUtils.degToRad((r[0] + r[1]) / 2)) - 1);
    const [anterior, posterior] = cercaDe0(restoB) < cercaDe0(restoA) ? [restoB, restoA] : [restoA, restoB];
    const centroT = (g0: number, g1: number) => (u: number) => {
      const d = dir(T, g0 + u * (g1 - g0), new THREE.Vector3());
      return v3(T.centro).addScaledVector(d, T.radio * 0.06).toArray();
    };
    defs.push({ anillo: T, a0: s0, a1: s1, largo: 1.0, borde: centroT(s0, s1) });
    defs.push({ anillo: T, a0: anterior[0], a1: anterior[1], largo: 1.3, borde: centroT(anterior[0], anterior[1]) });
    defs.push({ anillo: T, a0: posterior[0], a1: posterior[1], largo: 1.1, borde: centroT(posterior[0], posterior[1]) });
    // Mitral: valva anterior (en continuidad con la aórtica, ~1/3 del anillo pero más alta) y posterior
    const M = ANILLOS.mitral;
    const m0 = referencias.valvas.mitralAnterior - 65, m1 = referencias.valvas.mitralAnterior + 65;
    const lineaCierre = (g: number) => v3(M.centro).addScaledVector(dir(M, g, new THREE.Vector3()), M.radio * 0.36).toArray();
    defs.push({ anillo: M, a0: m0, a1: m1, largo: 1.7, borde: (u) => lineaCierre(m0 - u * 230) });
    defs.push({ anillo: M, a0: m1, a1: m0 + 360, largo: 1.0, borde: (u) => lineaCierre(m1 + u * 230) });

    return defs.map((d) => {
      const n = (U + 1) * (W + 1);
      const geo = registrar(new THREE.BufferGeometry());
      const pos = new Float32Array(n * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(indices);
      const malla = new THREE.Mesh(geo, matValva);
      malla.renderOrder = 3;
      const posBorde = new Float32Array((U + 1) * 3);
      const geoBorde = registrar(new THREE.BufferGeometry());
      geoBorde.setAttribute('position', new THREE.BufferAttribute(posBorde, 3));
      const lineaBorde = new THREE.Line(geoBorde, matBorde);
      lineaBorde.renderOrder = 4;
      aparatoValvular.add(malla, lineaBorde);
      // Precalcula los puntos del anillo y del borde de cierre
      const C = v3(d.anillo.centro), N = v3(d.anillo.normal);
      const anillo = Array.from({ length: U + 1 }, (_, i) => C.clone().addScaledVector(dir(d.anillo, d.a0 + (i / U) * (d.a1 - d.a0), new THREE.Vector3()), d.anillo.radio));
      const borde = Array.from({ length: U + 1 }, (_, i) => v3(d.borde(i / U)));
      const p = new THREE.Vector3(), cerrado = new THREE.Vector3(), abiertoP = new THREE.Vector3();
      const actualizar = (abierto: number) => {
        for (let i = 0; i <= U; i++)
          for (let j = 0; j <= W; j++) {
            const v = j / W;
            cerrado.copy(anillo[i]).lerp(borde[i], v).addScaledVector(N, 0.3 * v);
            abiertoP.copy(anillo[i]).lerp(C, 0.22 * v).addScaledVector(N, d.largo * v);
            p.copy(cerrado).lerp(abiertoP, abierto);
            pos.set([p.x, p.y, p.z], (i * (W + 1) + j) * 3);
            if (j === W) posBorde.set([p.x, p.y, p.z], i * 3);
          }
        geo.attributes.position.needsUpdate = true;
        geoBorde.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
      };
      actualizar(0);
      // Puntos del borde libre (para las cuerdas)
      const libre = (i: number) => new THREE.Vector3().fromArray(pos, (i * (W + 1) + W) * 3);
      return { anillo: d.anillo, actualizar, libre, U, pos, W };
    });
  }

  function crearPapilaresYCuerdas() {
    const PAP = referencias.papilares as Record<string, { base: number[]; punta: number[] }>;
    const Y = new THREE.Vector3(0, 1, 0);
    const lista: { punta: THREE.Vector3; valva: (typeof valvas)[number]; i: number }[] = [];
    for (const [nombre, p] of Object.entries(PAP)) {
      const base = v3(p.base), punta = v3(p.punta);
      const eje = punta.clone().sub(base);
      const izquierdo = nombre.startsWith('vi_');
      const cono = new THREE.Mesh(registrar(new THREE.CylinderGeometry(izquierdo ? 0.2 : 0.13, izquierdo ? 0.5 : 0.3, eje.length(), 16, 1)), matPapilar);
      cono.position.copy(base).add(punta).multiplyScalar(0.5);
      cono.quaternion.setFromUnitVectors(Y, eje.normalize());
      cono.renderOrder = 2;
      aparatoValvular.add(cono);
      // Cada papilar sostiene los bordes libres más cercanos de su válvula
      const propias = valvas.filter((v) => v.anillo === (izquierdo ? ANILLOS.mitral : ANILLOS.tricuspide));
      const candidatos = propias.flatMap((valva) => [3, 6, 9, 12, 15].map((i) => ({ valva, i, d: valva.libre(i).distanceTo(punta) })));
      candidatos.sort((a, b) => a.d - b.d);
      for (const c of candidatos.slice(0, izquierdo ? 5 : 4)) lista.push({ punta, valva: c.valva, i: c.i });
    }
    const pos = new Float32Array(lista.length * 6);
    const geo = registrar(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lineas = new THREE.LineSegments(geo, matCuerda);
    lineas.renderOrder = 3;
    aparatoValvular.add(lineas);
    return () => {
      lista.forEach((c, k) => {
        const q = c.valva.libre(c.i);
        pos.set([c.punta.x, c.punta.y, c.punta.z, q.x, q.y, q.z], k * 6);
      });
      geo.attributes.position.needsUpdate = true;
    };
  }

  // Anillos fibrosos: un trazo fino
  for (const an of [ANILLOS.tricuspide, ANILLOS.mitral]) {
    const puntosAnillo = Array.from({ length: 48 }, (_, i) => {
      const t = (i / 48) * Math.PI * 2;
      return v3(an.centro).addScaledVector(v3(an.arriba), an.radio * Math.cos(t)).addScaledVector(v3(an.derecha), an.radio * Math.sin(t));
    });
    const tubo = new THREE.Mesh(registrar(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntosAnillo, true), 96, 0.04, 8, true)), matAnillo);
    tubo.renderOrder = 3;
    aparatoValvular.add(tubo);
  }
  cuerdas();

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
      corazon.add(g);
      // Etiqueta afuera de la silueta, unida al LED por una línea guía (se ubica en cada cuadro).
      const texto = document.createElement('span');
      texto.className = 'c3d-etiqueta c3d-etiqueta-via';
      texto.textContent = `Vía accesoria · ${REGIONES[c].abreviatura}`;
      const linea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      svgGuia.appendChild(linea);
      capaGuia.appendChild(texto);
      // Dirección del cruce: de la aurícula al ventrículo (normal del anillo)
      const anillo = SEGMENTOS[c]![0].anillo === 'm' ? ANILLOS.mitral : ANILLOS.tricuspide;
      return { halo, luz, cruce, led, texto, linea, lado: 0, dir: v3(anillo.normal).normalize() };
    });

  // Puntos de muestra de la superficie para estimar la silueta en pantalla.
  const muestras: { malla: THREE.Mesh; p: THREE.Vector3 }[] = [];
  for (const m of mallas) {
    const pos = m.geometry.getAttribute('position');
    if (!pos) continue;
    const paso = Math.max(1, Math.floor(pos.count / 120));
    for (let i = 0; i < pos.count; i += paso) muestras.push({ malla: m, p: new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)) });
  }

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
  rotular('Rama derecha', medioDe('rama_derecha').add(new THREE.Vector3(-1.9, -0.5, 0.6)), etConduccion);
  rotular('Rama izquierda', medioDe('rama_izquierda').add(new THREE.Vector3(1.2, 0.5, 0.4)), etConduccion);
  rotular('Hemirrama anterior', medioDe('hemirrama_anterior').add(new THREE.Vector3(1.4, 0.4, 0.6)), etConduccion);
  rotular('Hemirrama posterior', medioDe('hemirrama_posterior').add(new THREE.Vector3(1.3, -1.7, 0.6)), etConduccion);
  rotular('Purkinje', medioDe('purkinje_vi_ant_0').add(new THREE.Vector3(1.2, -0.3, 0)), etConduccion);
  rotular('Tricúspide', puntoAnillo('tricuspide', 270, 1.2), etAnatomia);
  rotular('Mitral', puntoAnillo('mitral', 120, 1.4), etAnatomia);

  // --- Postproceso: resplandor de lo luminoso
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(ancho(), alto());
  composer.addPass(new RenderPass(escena, camara));
  const bloom = new UnrealBloomPass(new THREE.Vector2(ancho(), alto()), 0.32, 0.35, 0.95);
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
    const cerca = ancho() < 520 ? 0.95 : 1; // en el celular, algo más cerca pero con lugar para la etiqueta
    camara.position.set(0, 0, distancia(v === 'anillos' ? 30 : 37) * cerca);
    controles.target.set(0, 0, 0);
    controles.update();
    aplicarEtiquetas();
  };
  let etiquetasVisibles = false; // apagadas por defecto
  function aplicarEtiquetas() {
    aparatoValvular.visible = etiquetasVisibles;
    const angosto = ancho() < 520;
    for (const e of etConduccion) e.style.visibility = etiquetasVisibles && vistaActual === 'frontal' && !angosto ? 'visible' : 'hidden';
    for (const e of etAnatomia) e.style.visibility = etiquetasVisibles && !angosto ? 'visible' : 'hidden';
  }
  // Siempre abre en la vista frontal
  corazon.quaternion.copy(QUAT_FRONTAL);
  vista('frontal');

  // --- Llamada de la vía: etiqueta afuera de la silueta y línea hasta casi el LED
  const tmp = new THREE.Vector3();
  const aPantalla = (v: THREE.Vector3, w: number, h: number) => {
    tmp.copy(v).project(camara);
    return { x: ((tmp.x + 1) / 2) * w, y: ((1 - tmp.y) / 2) * h };
  };
  const puntosPantalla: { x: number; y: number }[] = [];
  function ubicarLlamadas() {
    if (leds.length === 0) return;
    const w = ancho();
    const h = alto();
    // Silueta proyectada (solo lo visible)
    puntosPantalla.length = 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const mu of muestras) {
      if (!mu.malla.visible) continue;
      const q = aPantalla(tmp.copy(mu.p).applyMatrix4(mu.malla.matrixWorld), w, h);
      puntosPantalla.push(q);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const radio = Math.max(x1 - x0, y1 - y0) / 2;
    const margen = 8;
    const ocupadas: { x: number; y: number; w: number; h: number }[] = [];
    for (const l of leds) {
      const p = aPantalla(l.led.getWorldPosition(new THREE.Vector3()), w, h);
      let dx = p.x - cx;
      let dy = p.y - cy;
      const largo = Math.hypot(dx, dy);
      if (largo < 1) { dx = 0; dy = -1; } else { dx /= largo; dy /= largo; }
      // Borde de la silueta en esa dirección: lo más lejano dentro de una franja alrededor del rayo
      const franja = radio * 0.18;
      let borde = 0;
      for (const q of puntosPantalla) {
        const ax = q.x - cx, ay = q.y - cy;
        const a = ax * dx + ay * dy;
        if (a > borde && Math.abs(ax * dy - ay * dx) < franja) borde = a;
      }
      borde = Math.max(borde, largo);
      const ew = l.texto.offsetWidth || 120;
      const eh = l.texto.offsetHeight || 20;
      const separacion = w < 520 ? 16 : 30;
      const limitar = (x: number, y: number) => ({
        x: Math.min(Math.max(x, margen), w - ew - margen),
        y: Math.min(Math.max(y, margen), h - eh - margen),
      });
      // Candidatas: en la dirección del LED y, si no cabe afuera, arriba, abajo o a los costados.
      const ancla = { x: cx + dx * (borde + separacion), y: cy + dy * (borde + separacion) };
      const candidatas = [
        limitar(ancla.x + dx * (ew / 2) - ew / 2, ancla.y + dy * (eh / 2) - eh / 2),
        limitar(p.x - ew / 2, y1 + separacion),
        limitar(p.x - ew / 2, y0 - separacion - eh),
        limitar(x0 - separacion - ew, p.y - eh / 2),
        limitar(x1 + separacion, p.y - eh / 2),
      ];
      // Se elige la que menos tapa el corazón y otras etiquetas; a igualdad, la más cercana al LED.
      const tapa = (c: { x: number; y: number }) => {
        let n = 0;
        for (const q of puntosPantalla) if (q.x > c.x - 4 && q.x < c.x + ew + 4 && q.y > c.y - 4 && q.y < c.y + eh + 4) n++;
        for (const o of ocupadas) if (c.x < o.x + o.w + 6 && c.x + ew + 6 > o.x && c.y < o.y + o.h + 6 && c.y + eh + 6 > o.y) n += 1000;
        return n;
      };
      const costos = candidatas.map((c, i) => {
        const d = Math.hypot(c.x + ew / 2 - p.x, c.y + eh / 2 - p.y);
        // Leve preferencia por la dirección natural (la primera)
        return tapa(c) * 1e4 + d + (i === 0 ? 0 : 40);
      });
      let elegida = costos.indexOf(Math.min(...costos));
      // Inercia: solo cambia de lado si la nueva posición es claramente mejor (evita saltos al girar)
      if (costos[l.lado] !== undefined && costos[l.lado] <= costos[elegida] * 1.25 + 30) elegida = l.lado;
      l.lado = elegida;
      const bx = candidatas[elegida].x;
      const by = candidatas[elegida].y;
      ocupadas.push({ x: bx, y: by, w: ew, h: eh });
      l.texto.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
      // Línea: desde el borde de la etiqueta más cercano al LED hasta casi el LED
      const sx = Math.min(Math.max(p.x, bx), bx + ew);
      const sy = Math.min(Math.max(p.y, by), by + eh);
      const lx = p.x - sx, ly = p.y - sy;
      const ll = Math.hypot(lx, ly);
      const hueco = 9;
      const visible = ll > hueco + 4;
      l.linea.style.display = visible ? '' : 'none';
      if (visible) {
        const k = (ll - hueco) / ll;
        l.linea.setAttribute('x1', sx.toFixed(1));
        l.linea.setAttribute('y1', sy.toFixed(1));
        l.linea.setAttribute('x2', (sx + lx * k).toFixed(1));
        l.linea.setAttribute('y2', (sy + ly * k).toFixed(1));
      }
    }
  }

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
    nodoSA.mat.emissiveIntensity = 0.6 + sa * 1.0;
    nodoSA.halo.material.opacity = sa * 0.45;
    const av = t >= 0.09 && t <= 0.17 ? 0.55 + 0.45 * Math.sin(((t - 0.09) / 0.08) * Math.PI) : 0;
    nodoAV.mat.emissive.copy(colorReposo).lerp(colorActivo, av);
    nodoAV.mat.emissiveIntensity = 0.6 + av * 0.9;
    nodoAV.halo.material.opacity = av * 0.4;

    for (const tr of tramos) {
      const a = pulso(t, tr.inicio, tr.fin, 0.12);
      tr.mat.emissive.copy(colorReposo).lerp(colorActivo, a);
      tr.mat.emissiveIntensity = 0.5 + a * 0.9;
      const visible = t >= tr.inicio && t <= tr.fin + 0.015;
      tr.chispa.visible = visible;
      if (visible) tr.chispa.position.copy(tr.curva.getPointAt(ventana(t, tr.inicio, tr.fin)));
    }

    for (const l of leds) {
      // Titila: encendido y apagado con bordes suaves, unas 1,6 veces por segundo.
      const onda = 0.5 + 0.5 * Math.sin((ahora / 1000) * Math.PI * 2 * 1.6);
      const encendido = suave(Math.min(1, Math.max(0, (onda - 0.25) / 0.5)));
      l.led.material.opacity = 0.25 + 0.75 * encendido;
      l.halo.material.opacity = 0.05 + 0.95 * encendido;
      l.halo.scale.setScalar(2.4 + 1.8 * encendido);
      l.luz.intensity = 0.5 + 9 * encendido;
      const c = ventana(t, VIA_INICIO, VIA_FIN);
      const enCruce = t >= VIA_INICIO && t <= VIA_FIN + 0.04;
      l.cruce.material.opacity = enCruce ? 1 - Math.max(0, (t - VIA_FIN) / 0.04) : 0;
      l.cruce.position.copy(l.dir).multiplyScalar(-1.6 + 3.2 * c);
    }

    // Válvulas AV: cerradas durante la sístole ventricular, abiertas en la diástole
    const abierto = (1 - suave(ventana(t, 0.2, 0.26))) + suave(ventana(t, 0.55, 0.63));
    if (aparatoValvular.visible) {
      for (const v of valvas) v.actualizar(Math.min(1, abierto));
      cuerdas();
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
    ubicarLlamadas();
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
    etiquetas: (b) => {
      etiquetasVisibles = b;
      aplicarEtiquetas();
    },
    coronarias: (b) => {
      for (const m of coronarias) m.visible = b;
    },
    destruir: () => {
      cancelAnimationFrame(cuadro);
      // Primero se quita lo visible; después se libera memoria (un error ahí no deja restos en pantalla).
      renderer.domElement.remove();
      etiquetas.domElement.remove();
      capaGuia.remove();
      observador.disconnect();
      for (const d of [controles, ...desechables, renderer]) {
        try {
          d.dispose();
        } catch (e) {
          console.warn('Ubicación 3D: no se pudo liberar un recurso', e);
        }
      }
    },
  };
}
