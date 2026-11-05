// Puente con el programa de Windows (C#): ver CONTRATO.md. Sin el programa (Chrome normal) funciona en "modo prueba".
import { aBase64, deBase64, descargar, toast } from './util.js';
import { E } from './estado.js';
import { agregar, t } from './i18n.js';

agregar({
  es: { 'puente.error': 'Ocurrió un error.' },
  en: { 'puente.error': 'Something went wrong.' },
});

export const puente = (window.chrome && window.chrome.webview) ? window.chrome.webview : null;
export const post = (msg) => { if (puente) puente.postMessage(msg); };

// ---- suscripción a mensajes del programa: alMensaje('pdf', async (m) => {...}) ----
const manejadores = new Map();
export function alMensaje(tipo, fn) {
  if (!manejadores.has(tipo)) manejadores.set(tipo, []);
  manejadores.get(tipo).push(fn);
}

// ---- peticiones con respuesta emparejada por id ----
let seqId = 0;
const pendientes = new Map();

export async function alRecibir(m) {
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch (_) { return; } }
  if (!m || !m.tipo) return;
  if (m.id !== undefined && m.id !== null && pendientes.has(m.id)) {
    const ok = pendientes.get(m.id); // el propio pedido se quita de la lista al resolverse
    if (m.tipo === 'cancelado') ok(null);
    else if (m.tipo === 'error') { toast(m.mensaje || t('puente.error'), true, 7000); ok(null); } // solo este pedido: no toca lo que esperan otras operaciones
    else ok(m);
    return;
  }
  for (const fn of manejadores.get(m.tipo) || []) await fn(m);
}
if (puente) puente.addEventListener('message', (e) => alRecibir(e.data));

// pedir(tipo, datos, {tiempo}) → Promise con la respuesta del mismo id, o null si se canceló, hubo error o pasó el tiempo máximo.
// tiempo: milisegundos de espera (por defecto 10 minutos, para operaciones largas como escribir muchas páginas).
// Tipos: 'abrirArchivos' (→ {tipo:'archivos', lista:[{nombre, datos(base64)}]}), 'guardarArchivo' y 'guardarVarios' (→ {tipo:'guardado', ruta, ...}),
// 'elegirCarpeta' (→ {ruta}), 'escribirEnCarpeta' (→ {escritos:[nombres], error?}).
export const TIEMPO_PEDIDO = 10 * 60 * 1000;
export function pedir(tipo, datos = {}, opt = {}) {
  const id = ++seqId;
  return new Promise((ok) => {
    let t = 0;
    const fin = (v) => { clearTimeout(t); if (pendientes.has(id)) { pendientes.delete(id); ok(v); } };
    pendientes.set(id, (v) => fin(v));
    t = setTimeout(() => fin(null), opt.tiempo || TIEMPO_PEDIDO);
    try {
      if (puente) post({ ...datos, tipo, id });
      else pruebaSinPrograma(tipo, datos).then((r) => fin(r), (e) => { console.warn('pedir', tipo, e); fin(null); });
    } catch (e) { console.warn('pedir', tipo, e); fin(null); }
  });
}

// ---- modo prueba (sin chrome.webview) ----
const ACEPTA = {
  pdf: '.pdf,application/pdf',
  imagenes: '.jpg,.jpeg,.png,.bmp,.gif,.tif,.tiff,.webp,image/*',
  'pdf+imagenes': '.pdf,application/pdf,.jpg,.jpeg,.png,.bmp,.gif,.tif,.tiff,.webp,image/*',
  office: '.doc,.docx,.xls,.xlsx,.ppt,.pptx',
};
const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip: 'application/zip', txt: 'text/plain' };
const mimeDe = (nombre, tipo) => MIME[tipo] || MIME[(/\.(\w+)$/.exec(nombre) || [])[1]] || 'application/octet-stream';

async function pruebaSinPrograma(tipo, d) {
  if (tipo === 'abrirArchivos') {
    return new Promise((ok) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = !!d.multiple; inp.accept = ACEPTA[d.tipos] || ACEPTA.pdf;
      inp.onchange = async () => {
        const lista = [];
        for (const f of inp.files) lista.push({ nombre: f.name, datos: aBase64(new Uint8Array(await f.arrayBuffer())) });
        ok(lista.length ? { tipo: 'archivos', lista } : null);
      };
      inp.oncancel = () => ok(null);
      inp.click();
    });
  }
  if (tipo === 'guardarArchivo') {
    descargar(deBase64(d.datos), d.nombre || 'archivo', mimeDe(d.nombre, d.tipo));
    return { tipo: 'guardado', ruta: d.nombre || 'archivo' };
  }
  if (tipo === 'guardarVarios') {
    const lista = d.archivos || [];
    for (const a of lista) { descargar(deBase64(a.datos), a.nombre, mimeDe(a.nombre)); await new Promise((r) => setTimeout(r, 300)); }
    return { tipo: 'guardado', ruta: '(carpeta de descargas)', cantidad: lista.length };
  }
  if (tipo === 'elegirCarpeta') return { tipo: 'carpeta', ruta: '(carpeta de descargas)' };
  if (tipo === 'escribirEnCarpeta') {
    const escritos = [];
    for (const a of d.archivos || []) { descargar(deBase64(a.datos), a.nombre, mimeDe(a.nombre)); escritos.push(a.nombre); await new Promise((r) => setTimeout(r, 300)); }
    return { tipo: 'escrito', escritos };
  }
  return null;
}
