// Extrae el corazón del atlas Z-Anatomy (basado en BodyParts3D) y genera:
//   src/corazon3d/modelo/corazon.glb   — mallas del corazón y grandes vasos
//   src/corazon3d/modelo/referencias.json — anillos AV, septum, nódulos y trayectos
//
// Fuente de datos: paquete npm @authorod/svitylo-3d-anatomy-data@1.2.0 (no es dependencia).
//   npm pack @authorod/svitylo-3d-anatomy-data@1.2.0 && tar -xzf authorod-svitylo-3d-anatomy-data-1.2.0.tgz
//   node scripts/extraer-corazon.mjs package/releases/1.2.0
//
// Licencia de los modelos: CC BY-SA 4.0 (Z-Anatomy), basado en BodyParts3D © DBCLS (CC BY 4.0).
// Ver docs/LICENCIA-MODELO-3D.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt, quantize, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const dir = process.argv[2];
if (!dir) throw new Error('Uso: node scripts/extraer-corazon.mjs <carpeta releases/1.2.0>');
const salida = 'src/corazon3d/modelo';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const manifiesto = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));

/** Estructuras a extraer: id del atlas → nombre en la app, grupo y fracción de triángulos a conservar. */
const ESTRUCTURAS = {
  'cardiovascular.right_atrium': ['auricula_derecha', 'auricula', 0.6],
  'cardiovascular.left_atrium': ['auricula_izquierda', 'auricula', 0.6],
  'cardiovascular.right_ventricle': ['ventriculo_derecho', 'ventriculo', 0.6],
  'cardiovascular.left_ventricle': ['ventriculo_izquierdo', 'ventriculo', 0.6],
  'cardiovascular.anterior_papillary_muscle_of_right_ventricle': ['papilar_vd_anterior', 'papilar', 0.5],
  'cardiovascular.inferior_papillary_muscle_of_right_ventricle': ['papilar_vd_inferior', 'papilar', 0.5],
  'cardiovascular.septal_papillary_muscle_of_right_ventricle': ['papilar_vd_septal', 'papilar', 0.5],
  'cardiovascular.inferior_papillary_muscle_of_left_ventricle': ['papilar_vi_inferior', 'papilar', 0.5],
  'cardiovascular.inferior_leaflet_of_right_atrioventricular_valve': ['tricuspide_inferior', 'valvula', 0.7],
  'cardiovascular.septal_leaflet_of_right_atrioventricular_valve': ['tricuspide_septal', 'valvula', 0.7],
  'cardiovascular.posterior_leaflet_of_left_atrioventricular_valve': ['mitral_posterior', 'valvula', 0.7],
  'cardiovascular.left_coronary_leaflet': ['aortica_izquierda', 'valvula', 0.7],
  'cardiovascular.non_coronary_leaflet': ['aortica_no_coronaria', 'valvula', 0.7],
  'cardiovascular.right_coronary_leaflet': ['aortica_derecha', 'valvula', 0.7],
  'cardiovascular.anterior_semilunar_leaflet_of_pulmonary_valve': ['pulmonar_anterior', 'valvula', 0.7],
  'cardiovascular.left_semilunar_leaflet_of_pulmonary_valve': ['pulmonar_izquierda', 'valvula', 0.7],
  'cardiovascular.right_semilunar_leaflet_of_pulmonary_valve': ['pulmonar_derecha', 'valvula', 0.7],
  'cardiovascular.left_coronary_artery': ['coronaria_izquierda', 'arteria', 0.7],
  'cardiovascular.right_coronary_artery': ['coronaria_derecha', 'arteria', 0.7],
  'cardiovascular.right_inferolateral_branch_of_right_coronary_artery': ['coronaria_derecha_rama', 'arteria', 0.7],
  'cardiovascular.ascending_aorta': ['aorta_ascendente', 'aorta', 0.6],
  'cardiovascular.aortic_arch': ['arco_aortico', 'aorta', 0.6],
  'cardiovascular.pulmonary_trunk': ['tronco_pulmonar', 'pulmonar', 0.6],
  'cardiovascular.bifurcation_of_pulmonary_trunk': ['bifurcacion_pulmonar', 'pulmonar', 0.6],
  'cardiovascular.superior_vena_cava': ['vena_cava_superior', 'vena', 0.6],
  'cardiovascular.inferior_vena_cava_thoracic_part': ['vena_cava_inferior', 'vena', 0.6],
  'cardiovascular.coronary_sinus': ['seno_coronario', 'vena_cardiaca', 0.7],
  'cardiovascular.great_cardiac_vein': ['vena_cardiaca_mayor', 'vena_cardiaca', 0.7],
  'cardiovascular.middle_cardiac_vein': ['vena_cardiaca_media', 'vena_cardiaca', 0.7],
  'cardiovascular.right_superior_pulmonary_vein': ['vena_pulmonar_sd', 'vena_pulmonar', 0.6],
  'cardiovascular.right_inferior_pulmonary_vein': ['vena_pulmonar_id', 'vena_pulmonar', 0.6],
  'cardiovascular.left_superior_pulmonary_vein': ['vena_pulmonar_si', 'vena_pulmonar', 0.6],
  'cardiovascular.left_inferior_pulmonary_vein': ['vena_pulmonar_ii', 'vena_pulmonar', 0.6],
};

// --- Lectura de las mallas -----------------------------------------------------

const porId = new Map(manifiesto.structures.map((s) => [s.id, s]));
const cacheChunks = new Map();

async function leerChunk(chunk) {
  if (cacheChunks.has(chunk.id)) return cacheChunks.get(chunk.id);
  const doc = await io.read(`${dir}/${chunk.files.standard.path}`);
  const nodo = doc.getRoot().listNodes()[0];
  const prim = nodo.getMesh().listPrimitives()[0];
  const m = nodo.getWorldMatrix();
  const pos = prim.getAttribute('POSITION');
  const ids = prim.getAttribute('_ID');
  const idx = prim.getIndices().getArray();
  const n = pos.getCount();
  const posiciones = new Float32Array(n * 3);
  const v = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, v); // ya normalizado a [-1, 1]
    posiciones[i * 3] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
    posiciones[i * 3 + 1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
    posiciones[i * 3 + 2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
  }
  const idsVertice = new Int32Array(n);
  const tmp = [0];
  for (let i = 0; i < n; i++) idsVertice[i] = ids.getElement(i, tmp)[0];
  const r = { posiciones, idsVertice, indices: idx, meshStart: chunk.meshStart };
  cacheChunks.set(chunk.id, r);
  return r;
}

async function extraer(idAtlas) {
  const s = porId.get(idAtlas);
  if (!s?.meshes?.length) throw new Error(`Sin malla: ${idAtlas}`);
  const global = s.meshes[0];
  const chunk = manifiesto.chunks.find((c) => global >= c.meshStart && global < c.meshStart + c.meshCount);
  const c = await leerChunk(chunk);
  const local = global - c.meshStart;
  // Detecta si _ID es local o global
  const objetivo = c.idsVertice.includes(local) ? local : global;
  const mapa = new Map();
  const pos = [];
  const tri = [];
  for (let t = 0; t < c.indices.length; t += 3) {
    const a = c.indices[t], b = c.indices[t + 1], d = c.indices[t + 2];
    if (c.idsVertice[a] !== objetivo || c.idsVertice[b] !== objetivo || c.idsVertice[d] !== objetivo) continue;
    for (const k of [a, b, d]) {
      if (!mapa.has(k)) {
        mapa.set(k, pos.length / 3);
        pos.push(c.posiciones[k * 3], c.posiciones[k * 3 + 1], c.posiciones[k * 3 + 2]);
      }
      tri.push(mapa.get(k));
    }
  }
  if (tri.length === 0) throw new Error(`Malla vacía: ${idAtlas}`);
  return { posiciones: new Float32Array(pos), indices: new Uint32Array(tri) };
}

const mallas = {};
for (const [idAtlas, [nombre, grupo, conservar]] of Object.entries(ESTRUCTURAS)) {
  mallas[nombre] = { ...(await extraer(idAtlas)), grupo, conservar, idAtlas };
}

/** Recorta una malla a los triángulos que cumplen la condición (vasos demasiado largos). */
function recortar(nombre, conservar) {
  const m = mallas[nombre];
  const p = m.posiciones;
  const tri = [];
  for (let t = 0; t < m.indices.length; t += 3) {
    const ok = [0, 1, 2].every((k) => { const i = m.indices[t + k] * 3; return conservar(p[i], p[i + 1], p[i + 2]); });
    if (ok) tri.push(m.indices[t], m.indices[t + 1], m.indices[t + 2]);
  }
  m.indices = new Uint32Array(tri);
}
// Altura mínima de los ventrículos (en metros, antes de convertir)
let yMinV = Infinity;
for (const n of ['ventriculo_derecho', 'ventriculo_izquierdo']) {
  const p = mallas[n].posiciones;
  for (let i = 1; i < p.length; i += 3) yMinV = Math.min(yMinV, p[i]);
}
let yMaxA = -Infinity;
for (const n of ['auricula_derecha', 'auricula_izquierda']) {
  const p = mallas[n].posiciones;
  for (let i = 1; i < p.length; i += 3) yMaxA = Math.max(yMaxA, p[i]);
}
recortar('vena_cava_inferior', (x, y) => y > yMinV + 0.035);
recortar('vena_cava_superior', (x, y) => y < yMaxA + 0.045);

// --- Marco del corazón: centro en las cámaras, centímetros ---------------------

const camaras = ['auricula_derecha', 'auricula_izquierda', 'ventriculo_derecho', 'ventriculo_izquierdo'];
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const c of camaras) {
  const p = mallas[c].posiciones;
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], p[i + k]);
    max[k] = Math.max(max[k], p[i + k]);
  }
}
const centro = min.map((v, k) => (v + max[k]) / 2);
// En el atlas: +Y arriba, +Z adelante. Se verifica de qué lado queda la izquierda del paciente.
const cx = (n) => { const p = mallas[n].posiciones; let s = 0; for (let i = 0; i < p.length; i += 3) s += p[i]; return s / (p.length / 3); };
const signoIzq = Math.sign(cx('ventriculo_izquierdo') - cx('ventriculo_derecho')) || 1;
const ESCALA = 100; // metros → centímetros
const cz = (n) => { const p = mallas[n].posiciones; let s = 0; for (let i = 2; i < p.length; i += 3) s += p[i]; return s / (p.length / 3); };
const cy = (n) => { const p = mallas[n].posiciones; let s = 0; for (let i = 1; i < p.length; i += 3) s += p[i]; return s / (p.length / 3); };
console.log('Orientación del atlas:', {
  'VI−VD en x': (cx('ventriculo_izquierdo') - cx('ventriculo_derecho')).toFixed(4),
  'VD−AI en z (VD es anterior)': (cz('ventriculo_derecho') - cz('auricula_izquierda')).toFixed(4),
  'aorta−VI en y': (cy('arco_aortico') - cy('ventriculo_izquierdo')).toFixed(4),
});
for (const m of Object.values(mallas)) {
  const p = m.posiciones;
  for (let i = 0; i < p.length; i += 3) {
    p[i] = (p[i] - centro[0]) * ESCALA * signoIzq; // +x = izquierda del paciente
    p[i + 1] = (p[i + 1] - centro[1]) * ESCALA;
    p[i + 2] = (p[i + 2] - centro[2]) * ESCALA;
  }
  if (signoIzq < 0) for (let t = 0; t < m.indices.length; t += 3) [m.indices[t + 1], m.indices[t + 2]] = [m.indices[t + 2], m.indices[t + 1]];
}

// --- Geometría auxiliar --------------------------------------------------------

const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(...a),
  norm: (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
const puntos = (n) => { const p = mallas[n].posiciones; const r = []; for (let i = 0; i < p.length; i += 3) r.push([p[i], p[i + 1], p[i + 2]]); return r; };
const promedio = (ps) => V.mul(ps.reduce((s, p) => V.add(s, p), [0, 0, 0]), 1 / ps.length);

/** Rejilla espacial para buscar vecinos cercanos rápido. */
function rejilla(ps, celda) {
  const g = new Map();
  const k = (p) => p.map((v) => Math.floor(v / celda)).join(',');
  ps.forEach((p) => { const c = k(p); if (!g.has(c)) g.set(c, []); g.get(c).push(p); });
  return {
    cercano(p, radio) {
      const [x, y, z] = p.map((v) => Math.floor(v / celda));
      let mejor = null, dmin = radio;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) {
        for (const q of g.get(`${x + i},${y + j},${z + l}`) ?? []) {
          const d = V.len(V.sub(p, q));
          if (d < dmin) { dmin = d; mejor = q; }
        }
      }
      return mejor;
    },
  };
}

/** Puntos de A que están a menos de `dist` cm de B (zona de contacto entre dos cámaras). */
function contacto(a, b, dist) {
  const g = rejilla(puntos(b), dist);
  return puntos(a).filter((p) => g.cercano(p, dist));
}

/** Ajusta un plano por PCA: devuelve centro y normal (menor varianza). */
function plano(ps) {
  const c = promedio(ps);
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of ps) { const d = V.sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j]; }
  // Iteración de potencia para el mayor; la normal es el producto de los dos mayores.
  const potencia = (M, excluir) => {
    let v = [0.3, 0.5, 0.8];
    for (let it = 0; it < 80; it++) {
      let w = [0, 1, 2].map((i) => V.dot(M[i], v));
      if (excluir) w = V.sub(w, V.mul(excluir, V.dot(w, excluir)));
      v = V.norm(w);
    }
    return v;
  };
  const e1 = potencia(cov);
  const e2 = potencia(cov, e1);
  return { centro: c, normal: V.norm(V.cross(e1, e2)) };
}

// --- Anillos AV ----------------------------------------------------------------

const centroDe = (n) => promedio(puntos(n));
function anillo(auricula, ventriculo) {
  let ps = contacto(auricula, ventriculo, 0.35);
  if (ps.length < 30) ps = contacto(auricula, ventriculo, 0.6);
  const { centro: c, normal } = plano(ps);
  // Normal apuntando hacia el ventrículo
  const haciaV = V.sub(centroDe(ventriculo), c);
  const n = V.dot(normal, haciaV) > 0 ? normal : V.mul(normal, -1);
  const radio = promedio(ps.map((p) => [V.len(V.sub(V.sub(p, c), V.mul(n, V.dot(V.sub(p, c), n)))), 0, 0]))[0];
  return { centro: c, normal: n, radio, n: ps.length };
}
const TA = anillo('auricula_derecha', 'ventriculo_derecho');
const MA = anillo('auricula_izquierda', 'ventriculo_izquierdo');

/**
 * Ejes en el plano del anillo, como en la vista OAI del esquema 2D:
 * ángulo 0 = anterosuperior, 90° = hacia la izquierda del paciente.
 */
function ejes(a) {
  const proy = (v) => V.norm(V.sub(v, V.mul(a.normal, V.dot(v, a.normal))));
  const arriba = proy([0, 0.7, 0.7]); // anterior y superior
  let derecha = V.norm(V.cross(a.normal, arriba));
  if (derecha[0] < 0) derecha = V.mul(derecha, -1); // hacia la izquierda del paciente (+x)
  return { arriba, derecha };
}
const ejesTA = ejes(TA);
const ejesMA = ejes(MA);

// --- Septum, puntas y referencias del sistema de conducción --------------------

const septoVD = contacto('ventriculo_derecho', 'ventriculo_izquierdo', 0.45);
const septoVI = contacto('ventriculo_izquierdo', 'ventriculo_derecho', 0.45);
const ejeLargo = V.norm(V.sub(promedio(puntos('ventriculo_izquierdo')), MA.centro)); // base → punta
const masLejos = (ps, dir) => ps.reduce((m, p) => (V.dot(p, dir) > V.dot(m, dir) ? p : m));
const puntaVI = masLejos(puntos('ventriculo_izquierdo'), ejeLargo);
const puntaVD = masLejos(puntos('ventriculo_derecho'), ejeLargo);

// Ostium del seno coronario: extremo del seno más cercano a la aurícula derecha
const ad = rejilla(puntos('auricula_derecha'), 1.0);
const sc = puntos('seno_coronario');
// El seno recorre el surco AV posterior de izquierda a derecha y desemboca en la AD:
// su extremo derecho (x mínimo) es el ostium.
const extremoDerecho = Math.min(...sc.map((p) => p[0]));
const ostium = promedio(sc.filter((p) => p[0] < extremoDerecho + 0.35));

// Nódulo sinusal: extremo inferior de la vena cava superior, del lado lateral (derecho) y anterior
const vcs = puntos('vena_cava_superior');
const unionVCS = vcs.filter((p) => ad.cercano(p, 0.8));
const nodoSA = masLejos(unionVCS.length ? unionVCS : vcs, V.norm([-1, -0.3, 0.6]));

// Nódulo AV: vértice del triángulo de Koch, entre el ostium del SC y la valva septal, hacia anterior
const valvaSeptal = puntos('tricuspide_septal');
const baseSeptal = valvaSeptal.filter((p) => V.dot(V.sub(p, TA.centro), TA.normal) < 0.3);
const nodoAV = V.add(V.mul(ostium, 0.45), V.mul(masLejos(baseSeptal.length ? baseSeptal : valvaSeptal, V.norm(V.sub(MA.centro, TA.centro))), 0.55));

// Cresta del septum muscular (fin del His y bifurcación): punto del septum más cercano a la base
const crestaSepto = masLejos(septoVI, V.mul(ejeLargo, -1));
const bifurcacion = V.add(V.mul(crestaSepto, 0.6), V.mul(promedio(septoVI), 0.4));

/** Trayecto sobre una superficie: interpola entre puntos y se pega al vértice más cercano. */
function trayecto(control, superficie, pasos = 14, adentro = 0) {
  const g = rejilla(superficie, 1.2);
  const r = [];
  for (let i = 0; i <= pasos; i++) {
    const t = (i / pasos) * (control.length - 1);
    const k = Math.min(control.length - 2, Math.floor(t));
    const p = V.add(V.mul(control[k], 1 - (t - k)), V.mul(control[k + 1], t - k));
    const q = g.cercano(p, 3.5) ?? p;
    r.push(adentro ? V.add(q, V.mul(V.norm(V.sub(V.add(p, [0, 0, 0]), q)), adentro)) : q);
  }
  // Suavizado (los extremos quedan fijos) para que el trayecto no siga el serrucho de la malla
  for (let it = 0; it < 4; it++) {
    for (let i = 1; i < r.length - 1; i++) r[i] = V.add(V.mul(r[i], 0.5), V.mul(V.add(r[i - 1], r[i + 1]), 0.25));
  }
  return r;
}

const supAD = puntos('auricula_derecha');
const supAI = puntos('auricula_izquierda');
const supVD = puntos('ventriculo_derecho');
const supVI = puntos('ventriculo_izquierdo');
const medioSAAV = V.mul(V.add(nodoSA, nodoAV), 0.5);
const ant = [0, 0, 1], post = [0, 0, -1], lat = [-1, 0, 0];

const trayectos = {
  internodal_anterior: trayecto([nodoSA, V.add(medioSAAV, V.mul(ant, 1.6)), nodoAV], supAD),
  internodal_medio: trayecto([nodoSA, V.add(medioSAAV, V.mul(lat, 1.2)), nodoAV], supAD),
  internodal_posterior: trayecto([nodoSA, V.add(medioSAAV, V.add(V.mul(post, 1.4), V.mul(lat, 0.6))), nodoAV], supAD),
  bachmann: trayecto([nodoSA, V.add(V.mul(V.add(nodoSA, centroDe('auricula_izquierda')), 0.5), [0, 1.2, 0.8]), masLejos(supAI, V.norm([0.3, 1, 0.6]))], [...supAD, ...supAI], 12),
  his: [nodoAV, V.add(V.mul(nodoAV, 0.5), V.mul(crestaSepto, 0.5)), crestaSepto, bifurcacion],
  rama_derecha: trayecto([bifurcacion, V.add(V.mul(bifurcacion, 0.55), V.mul(puntaVD, 0.45)), puntaVD], septoVD.length > 50 ? [...septoVD, ...supVD] : supVD, 16),
  rama_izquierda: trayecto([bifurcacion, V.add(V.mul(bifurcacion, 0.5), V.mul(puntaVI, 0.5)), puntaVI], septoVI.length > 50 ? [...septoVI, ...supVI] : supVI, 16),
};

// Purkinje: desde cada punta hacia la base por distintas paredes
const purkinje = [];
const desdePunta = (punta, superficie, centroBase, direcciones, prefijo) => {
  direcciones.forEach((d, i) => {
    const medio = V.add(V.mul(V.add(punta, centroBase), 0.5), V.mul(d, 2.2));
    const alto = V.add(V.mul(V.add(punta, V.mul(centroBase, 3)), 0.25), V.mul(d, 2.8));
    trayectos[`${prefijo}_${i}`] = trayecto([punta, medio, alto], superficie, 12);
    purkinje.push(`${prefijo}_${i}`);
  });
};
desdePunta(puntaVI, supVI, MA.centro, [[1, 0, 0.2], [0.4, 0, -1], [0.3, 0, 1], [0.9, 0, -0.6]].map(V.norm), 'purkinje_vi');
desdePunta(puntaVD, supVD, TA.centro, [[-1, 0, 0.3], [-0.2, 0, 1], [-0.8, 0, -0.6]].map(V.norm), 'purkinje_vd');

const redondear = (x) => (Array.isArray(x) ? x.map(redondear) : typeof x === 'number' ? Math.round(x * 1000) / 1000 : x);
const referencias = redondear({
  unidades: 'cm',
  ejes: { arriba: '+y', anterior: '+z', izquierdaPaciente: '+x' },
  anillos: {
    tricuspide: { centro: TA.centro, normal: TA.normal, radio: TA.radio, arriba: ejesTA.arriba, derecha: ejesTA.derecha },
    mitral: { centro: MA.centro, normal: MA.normal, radio: MA.radio, arriba: ejesMA.arriba, derecha: ejesMA.derecha },
  },
  nodos: { sinusal: nodoSA, auriculoventricular: nodoAV },
  ostiumSenoCoronario: ostium,
  senoCoronario: sc.length > 400 ? sc.filter((_, i) => i % Math.ceil(sc.length / 400) === 0) : sc,
  puntas: { vi: puntaVI, vd: puntaVD },
  trayectos,
  purkinje,
  centros: Object.fromEntries(camaras.map((c) => [c, centroDe(c)])),
});
// El seno coronario solo se usa para ubicar la vía subepicárdica; no se exporta entero.
delete referencias.senoCoronario;
// Vía posteroseptal subepicárdica: dentro del seno coronario, ~1,5 cm del ostium.
const candidatosSE = sc.filter((p) => Math.abs(V.len(V.sub(p, ostium)) - 1.5) < 0.4 && p[0] > ostium[0]);
const subepi = candidatosSE.length ? promedio(candidatosSE) : ostium;
referencias.sitios = redondear({ subepicardica: subepi, ostium });

// --- Escritura del GLB -----------------------------------------------------------

const doc = new Document();
const buffer = doc.createBuffer();
const escena = doc.createScene('corazon');
let totalTri = 0;
for (const [nombre, m] of Object.entries(mallas)) {
  // Simplificación con meshoptimizer (conserva la forma)
  const objetivo = Math.floor((m.indices.length * m.conservar) / 3) * 3;
  const [ind] = MeshoptSimplifier.simplify(m.indices, m.posiciones, 3, objetivo, 0.004, ['LockBorder']);
  totalTri += ind.length / 3;
  const pos = doc.createAccessor().setType('VEC3').setArray(m.posiciones).setBuffer(buffer);
  const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ind)).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx);
  const mesh = doc.createMesh(nombre).addPrimitive(prim);
  const nodo = doc.createNode(nombre).setMesh(mesh).setExtras({ grupo: m.grupo, atlas: m.idAtlas });
  escena.addChild(nodo);
}
doc.getRoot().setDefaultScene(escena);
doc.getRoot().getAsset().copyright =
  'Z-Anatomy (CC BY-SA 4.0), basado en BodyParts3D © The Database Center for Life Science (CC BY 4.0). Corazón extraído y simplificado para WPW Navigator 3D.';
await doc.transform(weld(), quantize({ quantizePosition: 14 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
doc.createExtension(EXTMeshoptCompression).setRequired(true);

mkdirSync(salida, { recursive: true });
await io.write(`${salida}/corazon.glb`, doc);
writeFileSync(`${salida}/referencias.json`, JSON.stringify(referencias, null, 1));
console.log(
  `OK · ${Object.keys(mallas).length} estructuras · ${totalTri} triángulos · lado izquierdo = ${signoIzq > 0 ? '+x' : '-x (corregido)'}`,
  `· TA r=${TA.radio.toFixed(2)} cm (${TA.n} pts) · MA r=${MA.radio.toFixed(2)} cm (${MA.n} pts) · septo ${septoVI.length}/${septoVD.length}`,
);
