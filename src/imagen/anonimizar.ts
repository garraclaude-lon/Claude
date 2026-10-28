/**
 * Ocultar o recortar zonas de la imagen del ECG que muestran datos personales.
 * Las coordenadas son fracciones (0–1) del ancho y del alto de la imagen, así
 * valen para cualquier resolución.
 */

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Franja vertical que se conserva al recortar (fracciones del alto). */
export interface Recorte {
  desde: number;
  hasta: number;
}

const limitar = (v: number) => Math.min(1, Math.max(0, v));

/** Agranda la caja un margen para cubrir bordes de letras mal ubicados. */
export function expandirCaja(c: Caja, margen = 0.015): Caja {
  const x = limitar(c.x - margen);
  const y = limitar(c.y - margen);
  return {
    x,
    y,
    ancho: limitar(c.x + c.ancho + margen) - x,
    alto: limitar(c.y + c.alto + margen) - y,
  };
}

/** Normaliza una caja dibujada en cualquier dirección y la limita a la imagen. */
export function normalizarCaja(x0: number, y0: number, x1: number, y1: number): Caja {
  const xa = limitar(Math.min(x0, x1));
  const ya = limitar(Math.min(y0, y1));
  return { x: xa, y: ya, ancho: limitar(Math.max(x0, x1)) - xa, alto: limitar(Math.max(y0, y1)) - ya };
}

/** Banda (desde el borde) dentro de la cual un dato se puede quitar recortando. */
const BANDA_RECORTE = 0.35;
/** No se recorta si quedaría menos de esta fracción del alto. */
const MINIMO_CONSERVADO = 0.5;

/**
 * Si todas las zonas están en franjas cercanas al borde superior o inferior
 * (donde suelen ir los datos del paciente), devuelve la franja que se
 * conserva sin ellas. Si alguna zona está en el medio del trazado, devuelve
 * null: en ese caso se oculta en lugar de recortar.
 */
export function calcularRecorte(cajas: Caja[], margen = 0.015): Recorte | null {
  if (cajas.length === 0) return null;
  let desde = 0;
  let hasta = 1;
  for (const c of cajas) {
    const fin = c.y + c.alto;
    if (fin <= BANDA_RECORTE) desde = Math.max(desde, fin + margen);
    else if (c.y >= 1 - BANDA_RECORTE) hasta = Math.min(hasta, c.y - margen);
    else return null;
  }
  desde = limitar(desde);
  hasta = limitar(hasta);
  return hasta - desde >= MINIMO_CONSERVADO ? { desde, hasta } : null;
}

// --- Operaciones sobre la imagen (navegador) -------------------------------

async function cargar(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function exportar(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo generar la imagen anonimizada.'))), 'image/jpeg', 0.92),
  );
}

/** Pinta de negro las zonas indicadas y devuelve una imagen nueva (sin metadatos). */
export async function ocultarZonas(blob: Blob, cajas: Caja[]): Promise<Blob> {
  const img = await cargar(blob);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo editar la imagen.');
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000000';
  for (const c of cajas.map((k) => expandirCaja(k))) {
    ctx.fillRect(
      Math.floor(c.x * canvas.width),
      Math.floor(c.y * canvas.height),
      Math.ceil(c.ancho * canvas.width),
      Math.ceil(c.alto * canvas.height),
    );
  }
  return exportar(canvas);
}

/** Conserva solo la franja indicada (todo el ancho). */
export async function recortarImagen(blob: Blob, r: Recorte): Promise<Blob> {
  const img = await cargar(blob);
  const y0 = Math.floor(r.desde * img.naturalHeight);
  const y1 = Math.ceil(r.hasta * img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = Math.max(1, y1 - y0);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo editar la imagen.');
  ctx.drawImage(img, 0, y0, img.naturalWidth, y1 - y0, 0, 0, img.naturalWidth, y1 - y0);
  return exportar(canvas);
}

export interface EditorImagen {
  ocultar: (blob: Blob, cajas: Caja[]) => Promise<Blob>;
  recortar: (blob: Blob, r: Recorte) => Promise<Blob>;
}

export const EDITOR_NAVEGADOR: EditorImagen = { ocultar: ocultarZonas, recortar: recortarImagen };
