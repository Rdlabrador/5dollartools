// Documento abierto: abrir/cargar un PDF, arrastrar y soltar, y cambios de documento con deshacer.
import { E, emit } from './estado.js';
import { $, toast, textoDe, mostrarCarga, ocultarCarga, abrirModal, cerrarModal, confirmar, deBase64 } from './util.js';
import { post, puente, alMensaje } from './puente.js';
import { pdfjsLib, pdfViewer, linkService, OPC_PDF, renderAviso } from './visor.js';
import { botones, sucio, claveDe, copiaItems, limitarDocs, podarDocs, commit } from './historial.js';
import { construirPdf, mensajeError } from './guardar.js';
import { asegurarOcultos, exigirOcultos } from './ocultos.js';
import { agregar, t } from './i18n.js';

agregar({
  es: {
    'documento.claveMal': 'La contraseña no es correcta. Inténtelo de nuevo.',
    'documento.claveEscriba': 'Escriba la contraseña para abrirlo.',
    'documento.abriendo': 'Abriendo el documento…',
    'documento.xfa': 'Este formulario no se puede llenar en este programa, pero sí puede firmarlo.',
    'documento.protegidoAviso': 'Este PDF está protegido: puede leerlo pero no guardarlo con cambios.',
    'documento.noAbre': 'No se pudo abrir este archivo. Puede estar dañado o no ser un PDF.',
    'documento.cambiosTitulo': 'Hay cambios sin guardar',
    'documento.cambiosMsg': 'Si abre otro PDF, perderá los cambios hechos. ¿Quiere continuar?',
    'documento.abrirOtro': 'Sí, abrir otro', 'documento.quedarme': 'No, quedarme',
    'documento.noEsPdf': 'Ese archivo no es un PDF.',
    'documento.cambioDoc': 'cambio del documento',
    'documento.abraPrimero': 'Abra un PDF primero.',
    'documento.protegidoModif': 'Este PDF está protegido: no se puede modificar.',
    'documento.aplicando': 'Aplicando el cambio…',
  },
  en: {
    'documento.claveMal': 'That password is not correct. Please try again.',
    'documento.claveEscriba': 'Type the password to open it.',
    'documento.abriendo': 'Opening the document…',
    'documento.xfa': 'This form cannot be filled in with this program, but you can still sign it.',
    'documento.protegidoAviso': 'This PDF is protected: you can read it, but you cannot save it with changes.',
    'documento.noAbre': 'This file could not be opened. It may be damaged or not a PDF.',
    'documento.cambiosTitulo': 'You have unsaved changes',
    'documento.cambiosMsg': 'If you open another PDF, you will lose the changes you made. Do you want to continue?',
    'documento.abrirOtro': 'Yes, open another', 'documento.quedarme': 'No, stay here',
    'documento.noEsPdf': 'That file is not a PDF.',
    'documento.cambioDoc': 'document change',
    'documento.abraPrimero': 'Open a PDF first.',
    'documento.protegidoModif': 'This PDF is protected, so it cannot be changed.',
    'documento.aplicando': 'Applying the change…',
  },
});

// Quita del archivo todo objeto al que no se llega desde Root/Info (pdf-lib no los elimina al borrar páginas:
// el contenido borrado seguiría dentro del archivo). `bloqueadas`: Set de ref.tag que se tratan como inexistentes
// (páginas borradas: las referencias que queden a ellas son "nulas", lo que el PDF permite). Devuelve cuántos objetos quitó.
export function recolectarBasura(doc, bloqueadas) {
  const { PDFRef, PDFArray } = PDFLib, ctx = doc.context, vistos = new Set(), pila = [];
  const visitar = (o) => {
    if (!o) return;
    if (o instanceof PDFRef) {
      if ((bloqueadas && bloqueadas.has(o.tag)) || vistos.has(o.tag)) return;
      vistos.add(o.tag); pila.push(o);
    } else if (o instanceof PDFArray) { for (let i = 0, n = o.size(); i < n; i++) visitar(o.get(i)); }
    else if (o.dict) { visitar(o.dict); }                       // flujos
    else if (typeof o.entries === 'function') { for (const [, v] of o.entries()) visitar(v); } // diccionarios
  };
  const t = ctx.trailerInfo || {};
  for (const k of Object.keys(t)) visitar(t[k]);
  while (pila.length) visitar(ctx.lookup(pila.pop()));
  let quitados = 0;
  for (const [ref] of ctx.enumerateIndirectObjects()) if (!vistos.has(ref.tag)) { ctx.delete(ref); quitados++; }
  return quitados;
}


// ---------- abrir ----------
async function pedirPassword(motivo) {
  $('passMsg').textContent = motivo === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD
    ? t('documento.claveMal') : t('documento.claveEscriba');
  $('passInput').value = ''; abrirModal('dlgPass'); $('passInput').focus();
  return new Promise((ok) => {
    const fin = (v) => { $('passInput').value = ''; cerrarModal('dlgPass'); $('passOk').onclick = $('passCancelar').onclick = $('passInput').onkeydown = null; ok(v); }; // la clave no queda en el campo
    $('passOk').onclick = () => fin($('passInput').value);
    $('passCancelar').onclick = () => fin(null);
    $('passInput').onkeydown = (e) => { if (e.key === 'Enter') fin($('passInput').value); };
  });
}

// opt.pagina: página a mostrar. opt.conservar: no reinicia el historial (lo usan los cambios de documento y deshacer/rehacer);
// con conservar, opt.items son los elementos colocados y opt.docId la versión de documento.
export async function cargarPDF(bytes, nombre, opt = {}) {
  mostrarCarga(t('documento.abriendo'));
  let nueva = null, cancelada = false, conClave = false, mutado = false, claveUsada = null;
  // estado previo: si algo falla a medias se restaura (cargarPDF es atómico)
  const previo = {
    items: E.items, docId: E.docId, docs: E.docs, docSeq: E.docSeq, hist: E.hist, histIdx: E.histIdx, guardadoIdx: E.guardadoIdx,
    pdf: E.pdf, tarea: E.tarea, nombre: E.nombreActual, protegido: E.protegido, claveDoc: E.claveDoc, bytesClave: E.bytesClave, avisoFijo: E.avisoFijo, formSucio: E.formSucio, paginas: { ...E.paginas },
  };
  try {
    nueva = pdfjsLib.getDocument({ data: bytes.slice(), ...OPC_PDF });
    nueva.onPassword = (cb, motivo) => {
      conClave = true; ocultarCarga();
      pedirPassword(motivo).then((pw) => {
        if (pw === null) { cancelada = true; nueva.destroy(); } else { claveUsada = pw; mostrarCarga(t('documento.abriendo')); cb(pw); }
      });
    };
    const doc = await nueva.promise;
    // éxito: cambiar de documento
    mutado = true;
    E.items = opt.conservar ? copiaItems(opt.items || []) : [];
    E.els.forEach((el) => el.remove()); E.els.clear(); E.nuevos.clear(); E.sel = null;
    for (const k in E.paginas) delete E.paginas[k];
    if (opt.conservar) E.docId = opt.docId;
    else {
      E.docs = new Map(); E.docId = 1; E.docSeq = 1;
      E.hist = [{ items: [], clave: claveDe([], 1), docId: 1 }]; E.histIdx = 0; E.guardadoIdx = 0;
    }
    E.formSucio = false;
    const anterior = E.tarea; E.tarea = nueva; E.pdf = doc;
    E.claveDoc = conClave ? claveUsada : null; E.bytesClave = conClave ? bytes : null; // para ofrecer quitar la contraseña (proteger.js)
    E.protegido = conClave; E.nombreActual = nombre || 'documento.pdf';
    E.avisoFijo = '';
    if (doc.isPureXfa) E.avisoFijo = () => t('documento.xfa');
    if (conClave) E.avisoFijo = () => t('documento.protegidoAviso');
    renderAviso();
    try {
      doc.annotationStorage.onSetModified = () => { E.formSucio = true; botones(); };
      doc.annotationStorage.onResetModified = () => { E.formSucio = false; botones(); };
    } catch (_) { /* versión sin esos ganchos */ }
    const listo = new Promise((r) => { E.resolverPaginas = r; });
    document.body.dataset.estado = 'abierto'; $('visor').classList.remove('hidden');
    pdfViewer.setDocument(doc); linkService.setDocument(doc, null);
    mutado = 'visor'; // desde aquí el visor ya muestra el documento nuevo
    if (anterior) { try { anterior.destroy(); } catch (_) { /* nada */ } }
    await Promise.race([listo, new Promise((r) => setTimeout(r, 8000))]);
    if (opt.pagina) pdfViewer.currentPageNumber = Math.min(opt.pagina, pdfViewer.pagesCount);
    botones(); ocultarCarga();
    emit('documentoCargado', { nombre: E.nombreActual, paginas: doc.numPages, conservar: !!opt.conservar, protegido: conClave });
    return true;
  } catch (e) {
    ocultarCarga();
    if (mutado === true && previo.pdf) {
      // falló antes de mostrar el nuevo: se vuelve al documento anterior tal como estaba
      Object.assign(E, { items: previo.items, docId: previo.docId, docs: previo.docs, docSeq: previo.docSeq, hist: previo.hist, histIdx: previo.histIdx,
        guardadoIdx: previo.guardadoIdx, pdf: previo.pdf, tarea: previo.tarea, nombreActual: previo.nombre, protegido: previo.protegido, claveDoc: previo.claveDoc, bytesClave: previo.bytesClave,
        avisoFijo: previo.avisoFijo, formSucio: previo.formSucio });
      for (const k in previo.paginas) E.paginas[k] = previo.paginas[k];
      try { renderAviso(); pdfViewer.setDocument(previo.pdf); linkService.setDocument(previo.pdf, null); } catch (_) { /* nada */ }
      if (nueva) { try { nueva.destroy(); } catch (_) { /* nada */ } }
      emit('sincronizar'); botones();
    } else if (nueva && !mutado) { try { nueva.destroy(); } catch (_) { /* nada */ } }
    if (cancelada || (e && e.name === 'PasswordException')) return false;
    console.error(e);
    toast(t('documento.noAbre'), true, 6000);
    return false;
  }
}

export async function descartarCambios() {
  if (!E.pdf || !sucio()) return true;
  return confirmar(t('documento.cambiosTitulo'), t('documento.cambiosMsg'), t('documento.abrirOtro'), t('documento.quedarme'));
}
export async function abrir() {
  if (!(await descartarCambios())) return;
  if (puente) post({ tipo: 'abrir' }); else { $('archivo').value = ''; $('archivo').click(); }
}
async function abrirArchivo(f) {
  if (!f) return;
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast(t('documento.noEsPdf'), true); return; }
  if (!(await descartarCambios())) return;
  await cargarPDF(new Uint8Array(await f.arrayBuffer()), f.name);
}
$('bAbrir').onclick = abrir; $('bAbrirGrande').onclick = abrir;
$('archivo').onchange = () => abrirArchivo($('archivo').files[0]);
let arrastres = 0;
addEventListener('dragenter', (e) => { e.preventDefault(); arrastres++; $('soltar').classList.remove('hidden'); });
addEventListener('dragleave', () => { if (--arrastres <= 0) { arrastres = 0; $('soltar').classList.add('hidden'); } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); arrastres = 0; $('soltar').classList.add('hidden'); abrirArchivo(e.dataTransfer.files[0]); });

alMensaje('pdf', async (m) => { await cargarPDF(deBase64(m.datos), m.nombre || 'documento.pdf'); });

// ---------- cambios de documento (con deshacer) ----------
// Registra una nueva versión del documento en el historial y la muestra. `antes` = bytes de la versión que se deja.
async function aplicarNuevo(antes, nuevos, descripcion, itemsNuevos) {
  const nuevoId = E.docSeq + 1;
  const pagina = pdfViewer.currentPageNumber;
  const idAntes = E.docId, tenia = E.docs.get(idAntes);
  E.docs.set(idAntes, antes); E.docs.set(nuevoId, nuevos);
  const ok = await cargarPDF(nuevos, E.nombreActual, { pagina, conservar: true, items: itemsNuevos, docId: nuevoId });
  if (!ok) { // el historial no debe apuntar a una versión que no existe
    E.docs.delete(nuevoId);
    if (tenia === undefined) E.docs.delete(idAntes); else E.docs.set(idAntes, tenia);
    return false;
  }
  E.docSeq = nuevoId;
  E.hist = E.hist.slice(0, E.histIdx + 1);
  E.hist.push({ items: copiaItems(itemsNuevos), clave: claveDe(itemsNuevos, nuevoId), docId: nuevoId, desc: descripcion || (() => t('documento.cambioDoc')) });
  if (E.hist.length > 51) { E.hist.shift(); E.guardadoIdx--; }
  E.histIdx = E.hist.length - 1;
  limitarDocs(); podarDocs(); botones();
  return true;
}

function revisarListo() {
  if (!E.pdf) { toast(t('documento.abraPrimero'), true); return false; }
  if (E.protegido) { toast(t('documento.protegidoModif'), true, 5000); return false; }
  if (E.cambiando || !$('carga').classList.contains('hidden') || E.esperando) return false;
  return true;
}

// cambiarDocumento(descripcion, async (doc, PDFLib) => {...}) → true si se aplicó, false si falló (ya avisó al usuario).
// Los elementos colocados y lo escrito en el formulario quedan impresos en el documento. Se puede deshacer (Ctrl+Z).
// opt.desdeAplicarOcultar: solo lo usa aplicarOcultar (proteger.js) para no bloquearse a sí mismo.
export async function cambiarDocumento(descripcion, fn, opt = {}) {
  if (!revisarListo()) return false;
  if (!opt.desdeAplicarOcultar) {
    if (!(await asegurarOcultos())) return false;   // zonas "ocultar" sin aplicar: se aplican (o se cancela) antes de tocar el documento
    if (!revisarListo()) return false;
  }
  E.cambiando = true;
  try {
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    commit();
    mostrarCarga(descripcion ? `${textoDe(descripcion)}…` : t('documento.aplicando'));
    const antes = await E.pdf.saveDocument();
    const bytes = await construirPdf(false, antes); // reutiliza `antes`: no se guarda el documento dos veces
    const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    await fn(doc, PDFLib);
    recolectarBasura(doc);
    const nuevos = await doc.save();
    return await aplicarNuevo(antes, nuevos, descripcion, []);
  } catch (e) {
    ocultarCarga(); console.error(e); toast(mensajeError(e), true, 6000);
    return false;
  } finally { E.cambiando = false; }
}

// reemplazarDocumento(bytes, descripcion, {conservarElementos}) → true/false. `bytes` = Uint8Array, ArrayBuffer o texto base64.
// Para cuando la nueva versión ya viene hecha (p. ej. desde C#). Por defecto los elementos colocados se descartan
// (siguen en el historial: Ctrl+Z los recupera); con conservarElementos se mantienen sobre el nuevo documento.
export async function reemplazarDocumento(bytes, descripcion, opt = {}) {
  if (!revisarListo()) return false;
  if (typeof bytes === 'string') bytes = deBase64(bytes);
  else if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
  E.cambiando = true;
  try {
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    commit();
    mostrarCarga(descripcion ? `${textoDe(descripcion)}…` : t('documento.aplicando'));
    const antes = await E.pdf.saveDocument();
    return await aplicarNuevo(antes, bytes, descripcion, opt.conservarElementos ? E.items : []);
  } catch (e) {
    ocultarCarga(); console.error(e); toast(mensajeError(e), true, 6000);
    return false;
  } finally { E.cambiando = false; }
}

// bytes del documento tal como está ahora (formulario y elementos colocados incluidos)
// Con zonas "ocultar" sin aplicar pide aplicarlas; si el usuario cancela lanza un error con `cancelado: true`.
export async function bytesActuales(opt = {}) {
  if (!opt.desdeAplicarOcultar) await exigirOcultos();
  return construirPdf(false);
}
