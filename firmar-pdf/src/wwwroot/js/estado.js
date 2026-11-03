// Estado compartido de la interfaz (un solo objeto mutable) y un bus de eventos simple.
export const CLAVE_FIRMA = 'firmarpdf.firma'; // antigua (una sola firma); solo para migrar
export const CLAVE_FIRMAS = 'firmarpdf.firmas';
export const MAX_FIRMAS = 10;
export const ANCHO_FIRMA_PT = 5 / 2.54 * 72; // 5 cm
export const CSS_POR_PT = 96 / 72;

export const E = {
  tarea: null, pdf: null, nombreActual: 'documento.pdf',
  protegido: false, formSucio: false, ajustar: true,
  items: [],                 // elementos colocados: {id,tipo,pagina,x,y,w,h,png?,texto?,size?}  (x,y,w,h en puntos de la página tal como se ve a escala 1)
  hist: [], histIdx: -1, guardadoIdx: -1,   // cada paso: {items, clave, docId, desc?}
  docs: new Map(),           // docId → bytes del PDF de esa versión (máx. 10), para deshacer cambios de documento
  docId: 1, docSeq: 1,       // versión de documento en uso / contador
  cambiando: false,          // true mientras se cambia o se recarga el documento por deshacer/rehacer
  herr: null, avisoHerr: '',   // herramienta de anotar activa (resaltar, dibujar…) y su aviso
  sel: null, colocando: null, esperando: null, avisoFijo: '',
  sigId: 1,
  paginas: {},               // número → página de pdf.js (para convertir coordenadas)
  els: new Map(),            // id → elemento DOM
  nuevos: new Set(),         // textos recién creados que aún no se confirman
  avisoSimbolos: false,
  resolverPaginas: null,
  sucioEnviado: false,
};

// Bus de eventos: on('nombre', fn) devuelve una función para darse de baja; emit('nombre', ...args).
const oyentes = new Map();
export function on(evento, fn) {
  if (!oyentes.has(evento)) oyentes.set(evento, new Set());
  oyentes.get(evento).add(fn);
  return () => oyentes.get(evento).delete(fn);
}
export function emit(evento, ...args) {
  const s = oyentes.get(evento); if (!s) return;
  for (const fn of [...s]) { try { fn(...args); } catch (e) { console.error(e); } }
}
