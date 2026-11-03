// Historial (deshacer / rehacer). Cada paso guarda los elementos colocados y la versión de documento (docId).
// Los cambios de documento (cambiarDocumento) guardan los bytes anteriores en E.docs (máx. 10 versiones).
import { E, emit, on } from './estado.js';
import { $, toast, textoDe } from './util.js';
import { post } from './puente.js';
import { cargarPDF } from './documento.js';
import { pdfViewer } from './visor.js';
import { agregar, t } from './i18n.js';

agregar({
  es: {
    'historial.versionFallo': 'No se pudo volver a esa versión del documento.',
    'historial.seDeshizo': 'Se deshizo: {desc}', 'historial.seRehizo': 'Se rehizo: {desc}',
    'historial.protegidoTit': 'Este PDF está protegido y no se puede guardar con cambios',
    'historial.cambioDoc': 'cambio del documento',
  },
  en: {
    'historial.versionFallo': 'Could not go back to that version of the document.',
    'historial.seDeshizo': 'Undone: {desc}', 'historial.seRehizo': 'Redone: {desc}',
    'historial.protegidoTit': 'This PDF is protected, so it cannot be saved with changes',
    'historial.cambioDoc': 'document change',
  },
});

export const MAX_DOCS = 10;
const MAX_PASOS = 51;
export const MAX_BYTES = 300 * 1024 * 1024; // tope de memoria de las versiones guardadas (siempre quedan la actual y la anterior)
export const bytesDocs = () => { let t = 0; const v = new Set(); for (const b of E.docs.values()) if (!v.has(b)) { v.add(b); t += b.byteLength; } return t; };

export const claveDe = (lista, docId) => JSON.stringify([docId, lista.map((i) => ({ ...i, png: i.png ? i.png.length : 0, src: i.src ? i.src.length : 0 }))]);
export const copiaItems = (lista) => lista.map((i) => ({ ...i }));

export const sucio = () => E.histIdx !== E.guardadoIdx || E.formSucio;
export function avisarSucio() {
  const v = !!(E.pdf && sucio());
  if (v !== E.sucioEnviado) { E.sucioEnviado = v; post({ tipo: 'sucio', valor: v }); }
}

// libera los bytes de versiones de documento que ya no están en el historial
export function podarDocs() {
  const vivos = new Set(E.hist.map((h) => h.docId)); vivos.add(E.docId);
  for (const id of [...E.docs.keys()]) if (!vivos.has(id)) E.docs.delete(id);
}
// deja a lo más MAX_DOCS versiones y MAX_BYTES en total: recorta el historial más antiguo
export function limitarDocs() {
  while ((E.docs.size > MAX_DOCS || (E.docs.size > 2 && bytesDocs() > MAX_BYTES)) && E.histIdx > 0) {
    const viejo = Math.min(...E.docs.keys());
    while (E.histIdx > 0 && E.hist.length > 1 && E.hist[0].docId <= viejo) { E.hist.shift(); E.histIdx--; E.guardadoIdx--; }
    const antes = E.docs.size; podarDocs();
    if (E.docs.size === antes) break;
  }
}

export function commit() {
  const clave = claveDe(E.items, E.docId);
  if (E.hist[E.histIdx] && E.hist[E.histIdx].clave === clave) return;
  E.hist = E.hist.slice(0, E.histIdx + 1);
  E.hist.push({ items: copiaItems(E.items), clave, docId: E.docId });
  if (E.hist.length > MAX_PASOS) { E.hist.shift(); E.guardadoIdx--; }
  E.histIdx = E.hist.length - 1; podarDocs(); botones();
}

export async function irA(n) {
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  const destino = E.hist[n];
  if (destino.docId === E.docId) {
    E.histIdx = n; E.items = copiaItems(destino.items); E.sel = null; E.nuevos.clear(); emit('sincronizar'); botones();
    return;
  }
  // cambia la versión del documento: se recarga desde los bytes guardados
  if (E.cambiando) return;
  E.cambiando = true;
  try {
    try { E.docs.set(E.docId, await E.pdf.saveDocument()); } catch (_) { /* se queda la copia anterior */ }
    const bytes = E.docs.get(destino.docId);
    if (!bytes) { toast(t('historial.versionFallo'), true, 5000); return; }
    const ok = await cargarPDF(bytes, E.nombreActual, { pagina: pdfViewer.currentPageNumber, conservar: true, items: destino.items, docId: destino.docId });
    if (ok) { E.histIdx = n; botones(); }
  } finally { E.cambiando = false; }
}
export async function deshacer() {
  if (E.cambiando || E.histIdx <= 0) return;
  const quitado = E.hist[E.histIdx];
  await irA(E.histIdx - 1);
  if (quitado.desc) toast(t('historial.seDeshizo', { desc: textoDe(quitado.desc) }));
}
export async function rehacer() {
  if (E.cambiando || E.histIdx >= E.hist.length - 1) return;
  const vuelto = E.hist[E.histIdx + 1];
  await irA(E.histIdx + 1);
  if (vuelto.desc) toast(t('historial.seRehizo', { desc: textoDe(vuelto.desc) }));
}
$('bDeshacer').onclick = deshacer; $('bRehacer').onclick = rehacer;

export function botones() {
  $('bDeshacer').disabled = E.histIdx <= 0; $('bRehacer').disabled = E.histIdx >= E.hist.length - 1;
  $('bGuardar').disabled = E.protegido;
  $('bGuardar').title = E.protegido ? t('historial.protegidoTit') : t('index.guardarTit');
  avisarSucio();
}
on('idioma', botones); // el título del botón Guardar depende del idioma
