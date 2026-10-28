/**
 * Prepara el archivo del ECG para verlo en pantalla y, si se pide, enviarlo
 * a la lectura automática. Acepta JPG, PNG, BMP y PDF (primera página).
 * Todo ocurre en el navegador: el archivo no se guarda en ningún lado.
 */

export interface ImagenPreparada {
  /** Imagen en un formato que la IA acepta (JPEG o PNG). */
  blob: Blob;
  /** URL local para mostrarla (liberar con URL.revokeObjectURL). */
  url: string;
  nombre: string;
  /** Aviso para el usuario (p. ej., PDF con varias páginas). */
  nota?: string;
}

export const ACEPTA_ARCHIVOS =
  '.jpg,.jpeg,.png,.bmp,.pdf,image/jpeg,image/png,image/bmp,application/pdf';

const TIPOS_DIRECTOS = ['image/jpeg', 'image/png'];
const MAX_BYTES = 25 * 1024 * 1024;

export type TipoArchivo = 'imagen_directa' | 'imagen_convertir' | 'pdf' | 'no_soportado';

export function clasificarArchivo(nombre: string, tipo: string): TipoArchivo {
  const ext = nombre.toLowerCase().split('.').pop() ?? '';
  if (tipo === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (TIPOS_DIRECTOS.includes(tipo) || ['jpg', 'jpeg', 'png'].includes(ext)) return 'imagen_directa';
  if (tipo === 'image/bmp' || tipo === 'image/x-ms-bmp' || ext === 'bmp') return 'imagen_convertir';
  // Fotos de cámara en otros formatos (p. ej., WebP): se intenta convertir.
  if (tipo.startsWith('image/')) return 'imagen_convertir';
  return 'no_soportado';
}

export async function prepararArchivo(archivo: File): Promise<ImagenPreparada> {
  if (archivo.size > MAX_BYTES) {
    throw new Error('El archivo supera los 25 MB. Usá una imagen más liviana.');
  }
  const tipo = clasificarArchivo(archivo.name, archivo.type);
  switch (tipo) {
    case 'imagen_directa':
      return { blob: archivo, url: URL.createObjectURL(archivo), nombre: archivo.name };
    case 'imagen_convertir': {
      const blob = await convertirAPng(archivo);
      return { blob, url: URL.createObjectURL(blob), nombre: archivo.name };
    }
    case 'pdf':
      return renderizarPdf(archivo);
    default:
      throw new Error('Formato no admitido. Usá JPG, PNG, BMP o PDF.');
  }
}

function canvasABlob(canvas: HTMLCanvasElement, tipo: string, calidad?: number): Promise<Blob> {
  return new Promise((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo convertir la imagen.'))), tipo, calidad),
  );
}

async function convertirAPng(archivo: Blob): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('El navegador no pudo abrir esta imagen. Probá con JPG o PNG.');
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo convertir la imagen.');
    ctx.drawImage(img, 0, 0);
    return await canvasABlob(canvas, 'image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- PDF: pdf.js va incluido en la app y se carga solo cuando hace falta ----

interface PdfJs {
  getDocument(src: { data: ArrayBuffer }): { promise: Promise<PdfDoc> };
}
interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}
interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
}

let pdfjsPromesa: Promise<PdfJs> | null = null;

function cargarPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromesa) {
    pdfjsPromesa = (async () => {
      // El "worker" de pdf.js se carga en la misma página (sin Web Worker aparte):
      // así funciona igual en local, sin internet y dentro del visor de claude.ai.
      await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJs;
    })().catch(() => {
      pdfjsPromesa = null;
      throw new Error('No se pudo iniciar el lector de PDF.');
    });
  }
  return pdfjsPromesa;
}

async function renderizarPdf(archivo: File): Promise<ImagenPreparada> {
  const pdfjs = await cargarPdfJs();
  const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  const pagina = await doc.getPage(1);
  const base = pagina.getViewport({ scale: 1 });
  // Unos 2400 px del lado mayor: legible sin generar archivos enormes.
  const escala = Math.min(4, 2400 / Math.max(base.width, base.height));
  const viewport = pagina.getViewport({ scale: escala });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo leer el PDF.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pagina.render({ canvasContext: ctx, viewport }).promise;
  const blob = await canvasABlob(canvas, 'image/jpeg', 0.92);
  return {
    blob,
    url: URL.createObjectURL(blob),
    nombre: archivo.name,
    nota: doc.numPages > 1 ? `El PDF tiene ${doc.numPages} páginas: se usa solo la primera.` : undefined,
  };
}
