// Fase 4 "Convertir": PDF a Word, OCR (hacer el PDF buscable), texto del PDF y Office a PDF.
// El trabajo pesado lo hace el programa de Windows (crearDocx, ocr, ocrIdiomas, officeDisponible, officeAPdf: ver CONTRATO.md);
// aquí se lee el PDF con pdf.js (texto, fuentes, imágenes) y se arma la estructura.
import { E } from './estado.js';
import { agregar, t, tn, idioma } from './i18n.js';
import { toast, elegir, confirmar, pedirRangoPaginas, progreso, finProgreso, ocupado, aBase64, deBase64, abrirModal, cerrarModal } from './util.js';
import { pedir, puente } from './puente.js';
import { pdfjsLib, OPC_PDF } from './visor.js';
import { bytesActuales, cambiarDocumento, cargarPDF, descartarCambios } from './documento.js';
import { registrarHerramienta } from './herramientas.js';
import { mensajeError } from './guardar.js';
import { herrExportar, herrImagenes, unirBytes } from './paginas.js';

// ---------- textos (es / en) ----------
agregar({
  es: {
    'convertir.nombreDoc': 'documento.pdf',
    'convertir.abrirPrimero': 'Abra un PDF primero.',
    'convertir.soloPrograma': 'Esta función solo está en el programa de Windows.',
    'convertir.cancelado': 'Cancelado. No se guardó nada.',
    'convertir.sinClave': 'Este PDF tiene contraseña. Primero quítela con "Quitar contraseña".',
    'convertir.nPaginas.1': '{n} página',
    'convertir.nPaginas.n': '{n} páginas',
    'convertir.fallidas.1': 'No se pudo leer la página {pags}.',
    'convertir.fallidas.n': 'No se pudieron leer las páginas {pags}.',
    'convertir.omitidas.1': 'La página {pags} ya tiene texto; se omitió.',
    'convertir.omitidas.n': 'Las páginas {pags} ya tienen texto; se omitieron.',
    'convertir.guardadoEn': 'Guardado en {ruta}',
    // reconocimiento de texto (OCR)
    'convertir.ocr.noListo': 'No se pudo preparar el reconocimiento de texto.',
    'convertir.ocr.idiomaTitulo': 'Idioma del documento',
    'convertir.ocr.idiomaEtiqueta': 'Idioma del documento',
    'convertir.ocr.idiomaAyuda': 'Elija el idioma en que está escrito el documento, para que el texto se lea bien.',
    'convertir.ocr.continuar': 'Continuar',
    'convertir.ocr.seguir': 'Seguir de todos modos',
    'convertir.ocr.cancelar': 'Cancelar',
    'convertir.ocr.faltaAviso': 'Este computador no tiene el reconocimiento de texto en {idioma}. Puede seguir con otro idioma, pero las letras con tildes o signos especiales pueden salir mal.',
    'convertir.ocr.pasos': 'Para instalarlo:\n1. Abra Configuración de Windows.\n2. Elija Hora e idioma → Idioma.\n3. Agregue el idioma {idioma}.\n4. En sus Opciones, instale "Reconocimiento de texto".\n\nDespués vuelva a intentarlo.',
    'convertir.ocr.pasos.mac': 'Este Mac no tiene el reconocimiento de texto para {idioma}.\n\nActualice macOS en Ajustes del Sistema → General → Actualización de software y vuelva a intentarlo.',
    'convertir.ocr.ningunoTitulo': 'Falta el reconocimiento de texto',
    'convertir.ocr.ningunoMsg': 'Este computador no tiene instalado el reconocimiento de texto en {idioma}.',
    'convertir.ocr.entendido': 'Entendido',
    'convertir.ocr.cerrar': 'Cerrar',
    // PDF a Word
    'convertir.escaneadaTitulo': 'Página escaneada',
    'convertir.escaneadaWord': 'La página {n} parece una foto o un escaneo: no tiene texto que se pueda editar.\n\n¿Quiere reconocer el texto para pasarlo a Word? Tarda unos segundos por página. Si dice que no, la página queda como imagen.',
    'convertir.reconocer': 'Sí, reconocer el texto',
    'convertir.dejarImagen': 'No, dejarla como imagen',
    'convertir.aWord': 'PDF a Word',
    'convertir.aWordDesc': 'Pase el documento a Word para editarlo',
    'convertir.aWordAviso': 'El archivo de Word queda listo para editar. Las tablas y columnas pueden quedar distintas al original.',
    'convertir.continuar': 'Continuar',
    'convertir.cancelar': 'Cancelar',
    'convertir.preparando': 'Preparando la conversión…',
    'convertir.convirtiendoWord': 'Convirtiendo a Word (página {i} de {n})…',
    'convertir.muchasImagenes': 'Hay muchas imágenes: se reducirán a {dpi} dpi para que el archivo de Word no sea enorme.',
    'convertir.creandoWord': 'Creando el archivo de Word…',
    // hacer buscable
    'convertir.buscable': 'Hacer el PDF buscable (OCR)',
    'convertir.buscableDesc': 'Para poder buscar y copiar texto en documentos escaneados',
    'convertir.buscableTitulo': 'Hacer el PDF buscable',
    'convertir.modoAuto': 'Solo las páginas escaneadas',
    'convertir.modoAutoDesc': 'Recomendado: el programa las busca solo',
    'convertir.modoTodas': 'Todas las páginas',
    'convertir.modoAlgunas': 'Elegir las páginas',
    'convertir.quePaginas': '¿Qué páginas?',
    'convertir.buscandoEscaneadas': 'Buscando páginas escaneadas…',
    'convertir.sinEscaneadas': 'No se encontraron páginas escaneadas.',
    'convertir.reconociendo': 'Reconociendo el texto (página {i} de {n})…',
    'convertir.noReconocido': 'No se pudo reconocer texto en esas páginas.',
    'convertir.haciendoBuscable': 'Haciendo el PDF buscable',
    'convertir.buscableListo': 'Listo. Ahora puede buscar y copiar el texto. Guarde el documento para conservarlo.',
    // texto del PDF
    'convertir.copiar': 'Copiar todo el texto',
    'convertir.copiarDesc': 'Copie el texto del PDF para pegarlo en otro programa',
    'convertir.txt': 'Guardar como texto (.txt)',
    'convertir.txtDesc': 'Guarde solo el texto en un archivo simple',
    'convertir.leyendo': 'Leyendo el texto (página {n} de {total})…',
    'convertir.escaneadaTexto': 'La página {n} parece una foto o un escaneo, sin texto. ¿Quiere reconocer el texto de esas páginas? Tarda unos segundos por página.',
    'convertir.omitirlas': 'No, omitirlas',
    'convertir.sinTexto': 'Este PDF no tiene texto que se pueda copiar.',
    'convertir.copiado': 'Texto copiado. Ya puede pegarlo en otro programa.',
    'convertir.noCopiado': 'No se pudo copiar el texto.',
    // Office
    'convertir.office': 'Word, Excel o PowerPoint a PDF',
    'convertir.officeDesc': 'Convierta un documento de Word, Excel o PowerPoint',
    'convertir.officeSinDesc': 'Necesita Microsoft Office instalado en este computador',
    'convertir.officeSinMsg': 'Para convertir documentos de Word, Excel o PowerPoint a PDF este programa necesita Microsoft Office instalado en este computador, y no se encontró.\n\nSi lo instala, esta opción funcionará sola.',
    'convertir.officeSinTitulo': 'Falta Microsoft Office',
    'convertir.convirtiendoCon': 'Convirtiendo con {con}…',
    'convertir.listoPdf': 'Listo: ya está el PDF',
    'convertir.abrirNuevo': 'Abrir el nuevo PDF',
    'convertir.abrirNuevoDesc': 'Reemplaza al documento abierto',
    'convertir.agregarFinal': 'Agregarlo al final de este',
    'convertir.agregarFinalDesc': 'Sus páginas quedan al final del documento abierto',
    'convertir.agregadas.1': 'Se agregó 1 página.',
    'convertir.agregadas.n': 'Se agregaron {n} páginas.',
    // otras tarjetas
    'convertir.imagen': 'Exportar a imagen (JPG/PNG)',
    'convertir.imagenDesc': 'Guarde las páginas como fotos',
    'convertir.imagenesPdf': 'Imágenes a PDF',
    'convertir.imagenesPdfDesc': 'Convierta fotos en un documento PDF',
  },
  en: {
    'convertir.nombreDoc': 'document.pdf',
    'convertir.abrirPrimero': 'Please open a PDF first.',
    'convertir.soloPrograma': 'This feature is only available in the Windows app.',
    'convertir.cancelado': 'Cancelled. Nothing was saved.',
    'convertir.sinClave': 'This PDF has a password. Please remove it first with "Remove password".',
    'convertir.nPaginas.1': '{n} page',
    'convertir.nPaginas.n': '{n} pages',
    'convertir.fallidas.1': 'Page {pags} could not be read.',
    'convertir.fallidas.n': 'Pages {pags} could not be read.',
    'convertir.omitidas.1': 'Page {pags} already has text, so it was skipped.',
    'convertir.omitidas.n': 'Pages {pags} already have text, so they were skipped.',
    'convertir.guardadoEn': 'Saved to {ruta}',
    'convertir.ocr.noListo': 'Text recognition could not be started.',
    'convertir.ocr.idiomaTitulo': 'Document language',
    'convertir.ocr.idiomaEtiqueta': 'Document language',
    'convertir.ocr.idiomaAyuda': 'Choose the language the document is written in, so the text is read correctly.',
    'convertir.ocr.continuar': 'Continue',
    'convertir.ocr.seguir': 'Continue anyway',
    'convertir.ocr.cancelar': 'Cancel',
    'convertir.ocr.faltaAviso': 'This computer does not have text recognition for {idioma}. You can continue with another language, but accented letters and special characters may come out wrong.',
    'convertir.ocr.pasos': 'To install it:\n1. Open Windows Settings.\n2. Choose Time & Language → Language.\n3. Add the language {idioma}.\n4. Open its Options and install "Optical character recognition".\n\nThen try again.',
    'convertir.ocr.pasos.mac': 'This Mac does not have text recognition for {idioma}.\n\nUpdate macOS in System Settings → General → Software Update, then try again.',
    'convertir.ocr.ningunoTitulo': 'Text recognition is missing',
    'convertir.ocr.ningunoMsg': 'This computer does not have text recognition installed for {idioma}.',
    'convertir.ocr.entendido': 'Got it',
    'convertir.ocr.cerrar': 'Close',
    'convertir.escaneadaTitulo': 'Scanned page',
    'convertir.escaneadaWord': 'Page {n} looks like a photo or a scan: it has no text that can be edited.\n\nDo you want to recognize the text so it can be turned into Word? It takes a few seconds per page. If you say no, the page stays as an image.',
    'convertir.reconocer': 'Yes, recognize the text',
    'convertir.dejarImagen': 'No, keep it as an image',
    'convertir.aWord': 'PDF to Word',
    'convertir.aWordDesc': 'Turn the document into a Word file you can edit',
    'convertir.aWordAviso': 'The Word file will be ready to edit. Tables and columns may look different from the original.',
    'convertir.continuar': 'Continue',
    'convertir.cancelar': 'Cancel',
    'convertir.preparando': 'Getting the conversion ready…',
    'convertir.convirtiendoWord': 'Converting to Word (page {i} of {n})…',
    'convertir.muchasImagenes': 'There are many images, so they will be reduced to {dpi} dpi to keep the Word file from becoming huge.',
    'convertir.creandoWord': 'Creating the Word file…',
    'convertir.buscable': 'Make the PDF searchable (OCR)',
    'convertir.buscableDesc': 'To search and copy text in scanned documents',
    'convertir.buscableTitulo': 'Make the PDF searchable',
    'convertir.modoAuto': 'Scanned pages only',
    'convertir.modoAutoDesc': 'Recommended: the program finds them by itself',
    'convertir.modoTodas': 'All pages',
    'convertir.modoAlgunas': 'Choose the pages',
    'convertir.quePaginas': 'Which pages?',
    'convertir.buscandoEscaneadas': 'Looking for scanned pages…',
    'convertir.sinEscaneadas': 'No scanned pages were found.',
    'convertir.reconociendo': 'Recognizing the text (page {i} of {n})…',
    'convertir.noReconocido': 'No text could be recognized on those pages.',
    'convertir.haciendoBuscable': 'Making the PDF searchable',
    'convertir.buscableListo': 'Done. You can now search and copy the text. Save the document to keep it.',
    'convertir.copiar': 'Copy all the text',
    'convertir.copiarDesc': 'Copy the text of the PDF to paste it into another program',
    'convertir.txt': 'Save as text (.txt)',
    'convertir.txtDesc': 'Save only the text in a simple file',
    'convertir.leyendo': 'Reading the text (page {n} of {total})…',
    'convertir.escaneadaTexto': 'Page {n} looks like a photo or a scan, with no text. Do you want to recognize the text on those pages? It takes a few seconds per page.',
    'convertir.omitirlas': 'No, skip them',
    'convertir.sinTexto': 'This PDF has no text that can be copied.',
    'convertir.copiado': 'Text copied. You can now paste it into another program.',
    'convertir.noCopiado': 'The text could not be copied.',
    'convertir.office': 'Word, Excel or PowerPoint to PDF',
    'convertir.officeDesc': 'Turn a Word, Excel or PowerPoint document into a PDF',
    'convertir.officeSinDesc': 'Needs Microsoft Office installed on this computer',
    'convertir.officeSinMsg': 'To turn Word, Excel or PowerPoint documents into PDF, this program needs Microsoft Office installed on this computer, and it was not found.\n\nIf you install it, this option will start working by itself.',
    'convertir.officeSinTitulo': 'Microsoft Office is missing',
    'convertir.convirtiendoCon': 'Converting with {con}…',
    'convertir.listoPdf': 'Done: your PDF is ready',
    'convertir.abrirNuevo': 'Open the new PDF',
    'convertir.abrirNuevoDesc': 'It replaces the document that is open',
    'convertir.agregarFinal': 'Add it to the end of this one',
    'convertir.agregarFinalDesc': 'Its pages go at the end of the open document',
    'convertir.agregadas.1': '1 page was added.',
    'convertir.agregadas.n': '{n} pages were added.',
    'convertir.imagen': 'Export as images (JPG/PNG)',
    'convertir.imagenDesc': 'Save the pages as pictures',
    'convertir.imagenesPdf': 'Images to PDF',
    'convertir.imagenesPdfDesc': 'Turn pictures into a PDF document',
  },
});

// ---------- utilidades ----------
const baseNombre = () => (E.nombreActual || t('convertir.nombreDoc')).replace(/\.pdf$/i, '').replace(/-(firmado|protegido|comprimido|signed|protected|compressed)$/i, '');
const cancelacion = () => Object.assign(new Error('Cancelado'), { cancelado: true });
const pausa = () => new Promise((r) => setTimeout(r, 0));
const aBlob = (canvas, tipo, calidad) => new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('imagen'))), tipo, calidad));
const LIMITE_IMAGENES = 150 * 1024 * 1024; // suma máxima de imágenes (base64) para PDF a Word
const DPI_IMG_REDUCIDO = 110;
const nPaginas = () => (E.pdf ? E.pdf.numPages : 0);
const todasLasPaginas = () => Array.from({ length: nPaginas() }, (_, i) => i + 1);
function mediana(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function listo() {
  if (!E.pdf) { toast(t('convertir.abrirPrimero'), true); return false; }
  if (ocupado()) return false;
  return true;
}
function soloPrograma() {
  if (puente) return true;
  toast(t('convertir.soloPrograma'), true, 5000);
  return false;
}
function errorAviso(e) {
  finProgreso();
  if (e && e.cancelado) { toast(t('convertir.cancelado'), false, 5000); return; }
  console.error(e); toast(mensajeError(e), true, 6000);
}

// Documento de pdf.js para leer. Con contraseña se usa el ya abierto (sin los elementos colocados).
async function fuenteDoc() {
  if (E.protegido) return { doc: E.pdf, cerrar: async () => {} };
  const bytes = await bytesActuales();
  const tarea = pdfjsLib.getDocument({ data: bytes.slice(), ...OPC_PDF, fontExtraProperties: true });
  let doc;
  try { doc = await tarea.promise; } catch (e) { try { tarea.destroy(); } catch (_) { /* nada */ } throw e; }
  return { doc, cerrar: async () => { try { await tarea.destroy(); } catch (_) { /* nada */ } } };
}

// Dibuja la página a `dpi` (baja el dpi si es enorme) → {canvas, esc (píxeles por punto), vp}
async function dibujarPagina(pag, dpi, maxLado = 6000) {
  const v1 = pag.getViewport({ scale: 1 });
  let esc = dpi / 72; const mayor = Math.max(v1.width, v1.height) * esc;
  if (mayor > maxLado) esc = esc * maxLado / mayor;
  const vp = pag.getViewport({ scale: esc });
  const canvas = document.createElement('canvas'); canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pag.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  return { canvas, esc, vp };
}

// ================= lectura de una página =================
const Util = () => pdfjsLib.Util;

function estiloFuente(pag, nombreFuente, styles, cache) {
  if (cache.has(nombreFuente)) return cache.get(nombreFuente);
  let nombre = '', neg = false, cur = false, serif = false, mono = false;
  try {
    if (pag.commonObjs.has(nombreFuente)) {
      const f = pag.commonObjs.get(nombreFuente);
      nombre = String(f.name || f.fallbackName || '');
      neg = !!(f.bold || f.black); cur = !!f.italic; serif = !!f.isSerifFont; mono = !!f.isMonospace;
    }
  } catch (_) { /* fuente aún no resuelta */ }
  const nl = nombre.replace(/^[A-Z]{6}\+/, '');
  if (/bold|black|heavy|semibold|demi/i.test(nl)) neg = true;
  if (/italic|oblique/i.test(nl)) cur = true;
  const fam = (styles && styles[nombreFuente] && styles[nombreFuente].fontFamily) || '';
  let fuente;
  if (mono || /courier|mono|consolas/i.test(nl) || fam === 'monospace') fuente = 'Courier New';
  else if (/calibri/i.test(nl)) fuente = 'Calibri';
  else if (/arial|helvet|sans|verdana|tahoma|segoe|swiss/i.test(nl)) fuente = 'Arial';
  else if (/times|georgia|cambria|garamond|palatino|minion|roman|serif|book/i.test(nl) || serif || fam === 'serif') fuente = 'Times New Roman';
  else fuente = 'Arial';
  const r = { negrita: neg, cursiva: cur, fuente, nombre: nl };
  cache.set(nombreFuente, r);
  return r;
}

// elementos de texto de pdf.js → [{str, x, y (línea base, hacia abajo), size, w, negrita, cursiva, fuente}] en puntos de la página tal como se ve
function elementosDeTexto(pag, tc, vp, cache) {
  const res = [];
  for (const it of tc.items) {
    if (typeof it.str !== 'string' || !it.str.length) continue;
    const t = Util().transform(vp.transform, it.transform);
    let size = Math.hypot(t[2], t[3]) || Math.hypot(t[0], t[1]);
    if (!(size > 0)) continue;
    size = Math.round(size * 2) / 2;
    const f = estiloFuente(pag, it.fontName, tc.styles, cache);
    res.push({ str: it.str.replace(/ /g, ' '), x: t[4], y: t[5], size, w: Math.max(0, it.width * vp.scale), negrita: f.negrita, cursiva: f.cursiva, fuente: f.fuente });
  }
  return res;
}

const claveEstilo = (r) => `${r.negrita ? 1 : 0}${r.cursiva ? 1 : 0}|${r.fuente}|${r.tamPt}`;

// elementos → líneas [{x0, x1, y, size, runs:[{texto,tamPt,negrita,cursiva,fuente}], texto}] ordenadas de arriba abajo
export function construirLineas(its) {
  const orden = [...its].sort((a, b) => a.y - b.y || a.x - b.x);
  const grupos = [];
  for (const it of orden) {
    const g = grupos[grupos.length - 1];
    if (g && Math.abs(it.y - g.y) <= 0.3 * Math.max(it.size, g.size)) {
      g.items.push(it);
      if (it.size > g.size) { g.size = it.size; g.y = it.y; }
    } else grupos.push({ y: it.y, size: it.size, items: [it] });
  }
  const lineas = [];
  for (const g of grupos) {
    g.items.sort((a, b) => a.x - b.x);
    const runs = []; let prev = null;
    for (const it of g.items) {
      let txt = it.str;
      if (prev && txt.trim()) {
        const gap = it.x - (prev.x + prev.w), s = Math.max(it.size, prev.size);
        if (gap > 4 * s) txt = '\t' + txt;                                           // columnas: una tabulación
        else if (gap > 0.18 * s && !/\s$/.test(prev.str) && !/^\s/.test(txt)) txt = ' ' + txt;
      }
      const run = { texto: txt, tamPt: it.size, negrita: it.negrita, cursiva: it.cursiva, subrayado: false, fuente: it.fuente };
      const ult = runs[runs.length - 1];
      if (ult && (!txt.trim() || claveEstilo(ult) === claveEstilo(run))) ult.texto += txt; else runs.push(run);
      if (txt.trim()) prev = it; else if (prev) prev = { ...prev, w: prev.w + it.w };
    }
    while (runs.length && !runs[runs.length - 1].texto.trim()) runs.pop();
    if (!runs.length) continue;
    runs[runs.length - 1].texto = runs[runs.length - 1].texto.replace(/\s+$/, '');
    runs[0].texto = runs[0].texto.replace(/^[ ]+/, '');
    const texto = runs.map((r) => r.texto).join('');
    if (!texto.trim()) continue;
    const peso = new Map();
    for (const r of runs) peso.set(r.tamPt, (peso.get(r.tamPt) || 0) + r.texto.length);
    const size = [...peso.entries()].sort((a, b) => b[1] - a[1])[0][0];
    lineas.push({
      x0: Math.min(...g.items.map((i) => i.x)), x1: Math.max(...g.items.map((i) => i.x + i.w)),
      y: g.y, size, runs, texto,
    });
  }
  return lineas.sort((a, b) => a.y - b.y);
}

// líneas → párrafos [{top, bottom, y0 (línea base de la primera), yN (de la última), size, alineacion, sangriaPt, lineas:[...], runs}]
export function construirParrafos(lineas) {
  if (!lineas.length) return [];
  const largas = lineas.filter((l) => l.texto.length >= 20);
  const base = largas.length ? largas : lineas;
  const frec = new Map();
  for (const l of base) { const k = Math.round(l.x0 / 2) * 2; frec.set(k, (frec.get(k) || 0) + 1); }
  let L = [...frec.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  L = Math.min(L, ...base.map((l) => l.x0));
  const R = Math.max(...base.map((l) => l.x1));
  const ancho = Math.max(1, R - L);
  // interlineado típico de la página
  const dif = [];
  for (let i = 1; i < lineas.length; i++) {
    const d = lineas[i].y - lineas[i - 1].y;
    if (d > 0 && d < 2.2 * Math.max(lineas[i].size, lineas[i - 1].size)) dif.push(d);
  }
  const med = mediana(dif);
  for (const l of lineas) {
    const izq = l.x0 - L, der = R - l.x1, tol = Math.max(l.size * 1.2, ancho * 0.03);
    if (izq > 2 * l.size && der > 2 * l.size && Math.abs(izq - der) <= tol) l.al = 'centro';
    else if (izq > 3 * l.size && der < 1.5 * l.size) l.al = 'der';
    else l.al = 'izq';
  }
  const grupos = []; let cur = null;
  for (const l of lineas) {
    let nuevo = !cur;
    if (cur) {
      const prev = cur[cur.length - 1];
      const inter = Math.max(med || 1.2 * prev.size, 0.9 * prev.size);
      if (l.y - prev.y > 1.4 * inter) nuevo = true;                                             // salto vertical
      else if (Math.abs(l.size - prev.size) > Math.max(1, prev.size * 0.12)) nuevo = true;      // cambio de tamaño
      else if (l.al !== prev.al || l.al !== 'izq') nuevo = true;                                // centrado o a la derecha: una línea por párrafo
      else if (l.x0 - prev.x0 > 0.8 * l.size && l.x0 - L > 0.8 * l.size) nuevo = true;          // sangría nueva
      else if (prev.x1 < R - 3 * prev.size) nuevo = true;                                       // la línea anterior terminó corta
    }
    if (nuevo) { cur = [l]; grupos.push(cur); } else cur.push(l);
  }
  return grupos.map((ls) => {
    const al1 = ls[0].al;
    const tam = Math.max(...ls.map((l) => l.size));
    let alineacion = al1;
    if (al1 === 'izq' && ls.length >= 3 && ls.slice(0, -1).every((l) => R - l.x1 <= Math.max(0.8 * l.size, 3))) alineacion = 'just';
    const sangria = al1 === 'izq' ? Math.max(0, Math.min(...ls.map((l) => l.x0)) - L) : 0;
    // unir líneas en runs: se une con un espacio, o sin él si la línea anterior termina en guion partiendo una palabra
    const runs = [];
    ls.forEach((l, i) => {
      const rs = l.runs.map((r) => ({ ...r }));
      if (i > 0) {
        const ult = runs[runs.length - 1];
        if (/[A-Za-zÁ-ÿ]-$/.test(ult.texto) && /^[a-zß-ÿ]/.test(rs[0].texto)) ult.texto = ult.texto.slice(0, -1);
        else if (!/\s$/.test(ult.texto) && !/^\s/.test(rs[0].texto)) ult.texto += ' ';
      }
      for (const r of rs) {
        const u = runs[runs.length - 1];
        if (u && claveEstilo(u) === claveEstilo(r)) u.texto += r.texto; else runs.push(r);
      }
    });
    const p = ls[ls.length - 1];
    return {
      top: ls[0].y - ls[0].size, bottom: p.y + 0.25 * p.size, y0: ls[0].y, yN: p.y, size: tam, inter: med || 1.2 * tam,
      alineacion, sangriaPt: sangria < 4 ? 0 : Math.round(sangria), lineas: ls, runs,
    };
  });
}

// ---------- imágenes de la página ----------
// Recorre las operaciones de dibujo y devuelve las cajas (en puntos de la página tal como se ve) donde se pintan imágenes.
function cajasDeImagenes(ops, vp, W, H) {
  const OPS = pdfjsLib.OPS, U = Util();
  let ctm = [1, 0, 0, 1, 0, 0]; const pila = []; const cajas = []; const vistos = new Set();
  const dibuja = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject]);
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) pila.push(ctm);
    else if (fn === OPS.restore) { if (pila.length) ctm = pila.pop(); }
    else if (fn === OPS.transform) ctm = U.transform(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) { pila.push(ctm); if (args && args[0]) ctm = U.transform(ctm, args[0]); }
    else if (fn === OPS.paintFormXObjectEnd) { if (pila.length) ctm = pila.pop(); }
    else if (dibuja.has(fn)) {
      const m = U.transform(vp.transform, ctm);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
      let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
      let y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
      const w = x1 - x0, h = y1 - y0;
      if (w < 6 || h < 6) continue;
      const k = [x0, y0, w, h].map((v) => Math.round(v)).join(',');
      if (vistos.has(k)) continue; vistos.add(k);
      cajas.push({ x: x0, y: y0, w, h });
    }
  }
  return cajas;
}

// Lee una página: {W, H, lineas, imagenes:[{x,y,w,h}], letras (caracteres de texto sin espacios)}
async function leerPagina(pag, cacheFuentes) {
  const vp = pag.getViewport({ scale: 1 });
  const ops = await pag.getOperatorList();          // también deja listas las fuentes
  const tc = await pag.getTextContent();
  const its = elementosDeTexto(pag, tc, vp, cacheFuentes);
  const lineas = construirLineas(its);
  const imagenes = cajasDeImagenes(ops, vp, vp.width, vp.height);
  const letras = its.reduce((n, i) => n + i.str.replace(/\s/g, '').length, 0);
  return { W: vp.width, H: vp.height, lineas, imagenes, letras };
}
const cobertura = (c, W, H) => (c.w * c.h) / (W * H);
const esEscaneada = (info) => info.letras < 20 && info.imagenes.some((c) => cobertura(c, info.W, info.H) > 0.7);

// ================= OCR =================
// Idioma del DOCUMENTO para el reconocimiento (independiente del de la interfaz). Lo elige el usuario entre los instalados en Windows.
let idiomaOcr = null;
const base = (tag) => String(tag || '').toLowerCase().split('-')[0];
const mayus = (s) => (s ? s.charAt(0).toLocaleUpperCase(idioma()) + s.slice(1) : s);
function nombreIdioma(tag, corto) {
  try {
    const n = new Intl.DisplayNames([idioma()], { type: 'language', languageDisplay: 'standard' }).of(corto ? base(tag) : tag);
    if (n && n !== tag) return n;
  } catch (_) { /* etiqueta rara: se muestra tal cual */ }
  return tag;
}

// Diálogo corto con un selector de idioma. → etiqueta elegida o null si cancela. (Se arma aquí: no hay uno parecido en util.js.)
function dialogoIdiomaOcr(idiomas, porDefecto, aviso, textoSi) {
  return new Promise((ok) => {
    let dlg = document.getElementById('dlgIdiomaOcr');
    if (!dlg) {
      dlg = document.createElement('div'); dlg.className = 'modal hidden'; dlg.id = 'dlgIdiomaOcr';
      dlg.innerHTML = '<div class="caja"><h2 id="idiomaOcrTitulo"></h2><p id="idiomaOcrMsg" style="white-space:pre-line"></p>'
        + '<label for="idiomaOcrSel" id="idiomaOcrEt"></label><select id="idiomaOcrSel" class="campo" style="font-size:16px"></select>'
        + '<div class="pie"><button class="btn grande cancelar" id="idiomaOcrNo"></button><button class="btn grande primary" id="idiomaOcrSi"></button></div></div>';
      document.body.appendChild(dlg);
    }
    const sel = dlg.querySelector('#idiomaOcrSel');
    dlg.querySelector('#idiomaOcrTitulo').textContent = t('convertir.ocr.idiomaTitulo');
    dlg.querySelector('#idiomaOcrMsg').textContent = aviso ? t('convertir.ocr.idiomaAyuda') + '\n\n' + aviso : t('convertir.ocr.idiomaAyuda');
    dlg.querySelector('#idiomaOcrEt').textContent = t('convertir.ocr.idiomaEtiqueta');
    dlg.querySelector('#idiomaOcrNo').textContent = t('convertir.ocr.cancelar');
    dlg.querySelector('#idiomaOcrSi').textContent = textoSi;
    sel.innerHTML = '';
    for (const tag of idiomas) {
      const o = document.createElement('option'); o.value = tag; o.textContent = mayus(nombreIdioma(tag)); sel.appendChild(o);
    }
    sel.value = porDefecto;
    const fin = (v) => { cerrarModal('dlgIdiomaOcr'); dlg.querySelector('#idiomaOcrSi').onclick = dlg.querySelector('#idiomaOcrNo').onclick = null; ok(v); };
    dlg.querySelector('#idiomaOcrSi').onclick = () => fin(sel.value);
    dlg.querySelector('#idiomaOcrNo').onclick = () => fin(null);
    abrirModal('dlgIdiomaOcr'); sel.focus();
  });
}

// Pregunta el idioma del documento (si hay para elegir) y lo deja en idiomaOcr. → true si se puede seguir. `fijo`: etiqueta ya decidida (pruebas).
async function verificarOcr(fijo) {
  if (!soloPrograma()) return false;
  const r = await pedir('ocrIdiomas', {}, { tiempo: 30000 });
  if (!r) { toast(t('convertir.ocr.noListo'), true, 6000); return false; }
  const lista = Array.isArray(r.idiomas) ? r.idiomas.filter(Boolean) : [];
  const mio = idioma();                                              // el idioma de la interfaz es el que se espera por defecto
  const coincide = lista.find((x) => base(x) === mio);
  const falta = nombreIdioma(mio, true);
  const pasos = t('convertir.ocr.pasos', { idioma: falta });
  if (!lista.length) {
    idiomaOcr = null;
    await confirmar(t('convertir.ocr.ningunoTitulo'), t('convertir.ocr.ningunoMsg', { idioma: falta }) + '\n\n' + pasos, t('convertir.ocr.entendido'), t('convertir.ocr.cerrar'));
    return false;
  }
  if (fijo && lista.includes(fijo)) { idiomaOcr = fijo; return true; }
  if (lista.length === 1 && coincide) { idiomaOcr = coincide; return true; }   // no hay nada que elegir
  const aviso = coincide ? '' : t('convertir.ocr.faltaAviso', { idioma: falta }) + '\n\n' + pasos;
  const previo = lista.includes(idiomaOcr) ? idiomaOcr : null;
  const elegido = await dialogoIdiomaOcr(lista, coincide || previo || lista[0], aviso, coincide ? t('convertir.ocr.continuar') : t('convertir.ocr.seguir'));
  if (!elegido) return false;
  idiomaOcr = elegido;
  return true;
}

// Dibuja la página a 300 dpi (menos si es enorme) y la envía a reconocer. → resultado del programa + {esc, W, H} (esc = píxeles por punto)
async function ocrDePagina(pag) {
  const { canvas, esc } = await dibujarPagina(pag, 300, 6000);
  try {
    const blob = await aBlob(canvas, 'image/png');
    const png = aBase64(new Uint8Array(await blob.arrayBuffer()));
    const r = await pedir('ocr', { png, idioma: idiomaOcr || idioma() }, { tiempo: 3 * 60 * 1000 });
    if (!r || !r.resultado) return null;
    const v1 = pag.getViewport({ scale: 1 });
    return { ...r.resultado, esc: (r.resultado.anchoImg || canvas.width) / v1.width, W: v1.width, H: v1.height };
  } finally { canvas.width = canvas.height = 0; }
}
// líneas del OCR (píxeles) → líneas como las de construirLineas (puntos)
function lineasDeOcr(res) {
  const esc = res.esc || 1;
  const ls = (res.lineas || []).filter((l) => l.texto && l.texto.trim()).map((l) => ({
    x0: l.x / esc, x1: (l.x + l.ancho) / esc, y: (l.y + l.alto * 0.8) / esc, h: l.alto / esc, texto: l.texto.trim(),
  }));
  const med = mediana(ls.map((l) => l.h * 0.85));
  return ls.map((l) => {
    let s = l.h * 0.85;
    if (med && s / med > 0.7 && s / med < 1.35) s = med;
    s = Math.round(Math.min(36, Math.max(6, s)) * 2) / 2;
    return { x0: l.x0, x1: l.x1, y: l.y, size: s, texto: l.texto, runs: [{ texto: l.texto, tamPt: s, negrita: false, cursiva: false, subrayado: false, fuente: 'Arial' }] };
  }).sort((a, b) => a.y - b.y);
}

// ================= PDF a Word =================
async function recortePng(render, caja, maxLado = 2000) {
  const { canvas, esc } = render;
  const sx = Math.max(0, Math.floor(caja.x * esc)), sy = Math.max(0, Math.floor(caja.y * esc));
  const sw = Math.min(canvas.width - sx, Math.ceil(caja.w * esc)), sh = Math.min(canvas.height - sy, Math.ceil(caja.h * esc));
  if (sw < 2 || sh < 2) return null;
  const k = Math.min(1, maxLado / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
  try {
    c.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return aBase64(new Uint8Array(await (await aBlob(c, 'image/png')).arrayBuffer()));
  } finally { c.width = c.height = 0; }
}

function bloqueDeParrafo(p, anterior) {
  let antes;
  if (!anterior) antes = Math.max(0, p.top - 56.7);
  else if (anterior.tipo === 'p') antes = Math.max(0, p.y0 - anterior.yN - p.inter);
  else antes = Math.max(0, p.top - anterior.bottom);
  return {
    tipo: 'parrafo', alineacion: p.alineacion, sangriaPt: p.sangriaPt, espacioAntesPt: Math.round(Math.min(antes, 250) * 10) / 10,
    runs: p.runs.map((r) => ({ texto: r.texto, tamPt: r.tamPt, negrita: r.negrita, cursiva: r.cursiva, subrayado: false, fuente: r.fuente })),
  };
}

// Estructura de Word de las páginas (sin enviar). opt: {ocr:'si'|'no'|undefined (pregunta), alProgreso, cancelado()}
export async function estructuraWord(paginas, opt = {}) {
  const lista = paginas && paginas.length ? paginas : todasLasPaginas();
  const { doc, cerrar } = await fuenteDoc();
  const cacheFuentes = new Map(); let decisionOcr = opt.ocr === 'si' ? true : opt.ocr === 'no' ? false : (opt.decisionOcr === undefined ? null : opt.decisionOcr);
  const salida = { titulo: baseNombre(), paginas: [] };
  // muchas imágenes: si pasan del límite (base64) se vuelve a empezar con menos resolución (opt.reducir) → lanza {reducirImagenes:true}
  const dpiImg = opt.reducir ? DPI_IMG_REDUCIDO : 150, maxPx = opt.reducir ? Math.round(2000 * DPI_IMG_REDUCIDO / 150) : 2000;
  const limiteImg = opt.limiteImg || LIMITE_IMAGENES; let bytesImg = 0;
  if (opt.estado) opt.estado.fallidas = [];
  try {
    for (let i = 0; i < lista.length; i++) {
      if (opt.cancelado && opt.cancelado()) throw cancelacion();
      if (opt.alProgreso) opt.alProgreso(i, lista.length);
      await pausa();
      const pag = await doc.getPage(lista[i]);
      let render = null;
      try {
        const info = await leerPagina(pag, cacheFuentes);
        let lineas = info.lineas, imagenes = info.imagenes;
        if (esEscaneada(info)) {
          if (decisionOcr === null) {
            finProgreso();
            decisionOcr = await confirmar(t('convertir.escaneadaTitulo'), t('convertir.escaneadaWord', { n: lista[i] }), t('convertir.reconocer'), t('convertir.dejarImagen'));
            if (decisionOcr) decisionOcr = await verificarOcr();
            if (opt.estado) opt.estado.decisionOcr = decisionOcr;
            if (opt.alProgreso) opt.alProgreso(i, lista.length);
          }
          if (decisionOcr) {
            let r = null;
            try { r = await ocrDePagina(pag); } catch (e) { console.warn('ocr', lista[i], e); }
            if (r) { lineas = lineasDeOcr(r); imagenes = []; }
            else if (opt.estado) opt.estado.fallidas.push(lista[i]);
          }
        } else if (info.letras >= 20) {
          imagenes = imagenes.filter((c) => cobertura(c, info.W, info.H) <= 0.7);        // un fondo que cubre la página no se copia
        }
        const elementos = construirParrafos(lineas).map((p) => ({ top: p.top, p }));
        if (imagenes.length) render = await dibujarPagina(pag, dpiImg, 6000);
        for (const c of imagenes) {
          const png = await recortePng(render, c, maxPx);
          if (!png) continue;
          bytesImg += png.length;
          if (!opt.reducir && bytesImg > limiteImg) throw Object.assign(new Error('Demasiadas imágenes'), { reducirImagenes: true });
          const cx = c.x + c.w / 2, centrada = Math.abs(cx - info.W / 2) < info.W * 0.06;
          elementos.push({ top: c.y, img: { tipo: 'imagen', alineacion: centrada ? 'centro' : (c.x > info.W * 0.5 ? 'der' : 'izq'), imagenPng: png, anchoImgPt: Math.round(c.w * 10) / 10, altoImgPt: Math.round(c.h * 10) / 10, y: c.y, bottom: c.y + c.h } });
        }
        elementos.sort((a, b) => a.top - b.top);
        const bloques = []; let ant = null;
        for (const e of elementos) {
          if (e.p) {
            const b = bloqueDeParrafo(e.p, ant);
            bloques.push(b); ant = { tipo: 'p', yN: e.p.yN, bottom: e.p.bottom };
          } else {
            const antes = ant ? Math.max(0, e.img.y - ant.bottom) : Math.max(0, e.img.y - 56.7);
            bloques.push({ ...e.img, espacioAntesPt: Math.round(Math.min(antes, 250) * 10) / 10, y: undefined, bottom: undefined });
            ant = { tipo: 'i', bottom: e.img.bottom };
          }
        }
        if (!bloques.length) bloques.push({ tipo: 'parrafo', alineacion: 'izq', sangriaPt: 0, espacioAntesPt: 0, runs: [] });
        salida.paginas.push({ anchoPt: Math.round(info.W * 10) / 10, altoPt: Math.round(info.H * 10) / 10, bloques });
      } finally {
        if (render) render.canvas.width = render.canvas.height = 0;
        pag.cleanup();
      }
    }
  } finally { await cerrar(); }
  return salida;
}

const textoFallidas = (f) => tn('convertir.fallidas', f.length, { pags: f.join(', ') });
const textoOmitidas = (o) => tn('convertir.omitidas', o.length, { pags: o.join(', ') });
async function pdfAWord() {
  if (!listo()) return;
  if (!soloPrograma()) return;
  if (!(await confirmar(t('convertir.aWord'), t('convertir.aWordAviso'), t('convertir.continuar'), t('convertir.cancelar')))) return;
  let cancelar = false;
  try {
    progreso(t('convertir.preparando'), 0, () => { cancelar = true; });
    const estado = {}; // la fuente (bytesActuales) pide aplicar las zonas "ocultar" pendientes
    const hacer = (reducir) => estructuraWord(null, {
      reducir, estado, decisionOcr: estado.decisionOcr,
      cancelado: () => cancelar,
      alProgreso: (i, n) => progreso(t('convertir.convirtiendoWord', { i: i + 1, n }), i / n, () => { cancelar = true; }),
    });
    let documento;
    try { documento = await hacer(false); }
    catch (e) {
      if (!e || !e.reducirImagenes) throw e;
      toast(t('convertir.muchasImagenes', { dpi: DPI_IMG_REDUCIDO }), false, 8000);
      documento = await hacer(true);
    }
    progreso(t('convertir.creandoWord'));
    const r = await pedir('crearDocx', { documento, nombre: baseNombre() + '.docx' }, { tiempo: 10 * 60 * 1000 });
    finProgreso();
    if (r && r.ruta) {
      const f = estado.fallidas || [];
      toast(t('convertir.guardadoEn', { ruta: r.ruta }) + (f.length ? '. ' + textoFallidas(f) : ''), !!f.length, f.length ? 9000 : 7000);
    }
  } catch (e) { errorAviso(e); }
}

// ================= hacer el PDF buscable (OCR) =================
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function aWinAnsi(fuente, texto) {
  let r = '';
  for (const ch of texto) {
    try { fuente.encodeText(ch); r += ch; continue; } catch (_) { /* probar sin tilde */ }
    const s = sinTildes(ch);
    try { if (s) { fuente.encodeText(s); r += s; continue; } } catch (_) { /* nada */ }
    r += '?';
  }
  return r;
}

// Palabras del OCR en coordenadas del PDF: [{texto, x, y, ang (grados), size, ancho}] (x, y = esquina de la línea base, hacia la derecha del texto)
function palabrasEnPdf(res, pag) {
  const esc = res.esc || 1, vp = pag.getViewport({ scale: 1 }), out = [];
  for (const l of res.lineas || []) {
    for (const w of l.palabras || []) {
      if (!w.texto || !w.texto.trim()) continue;
      const hPt = w.alto / esc, wPt = w.ancho / esc;
      const size = Math.max(2, hPt);
      const vx = w.x / esc, vy = (w.y + w.alto) / esc - 0.2 * hPt;          // línea base: borde inferior menos el descendente
      const [x, y] = vp.convertToPdfPoint(vx, vy);
      const [x2, y2] = vp.convertToPdfPoint(vx + 1, vy);
      out.push({ texto: w.texto, x, y, ang: Math.atan2(y2 - y, x2 - x), size, ancho: wPt });
    }
  }
  return out;
}

// Agrega la capa de texto invisible a las páginas. ocr: Map(n → palabras en PDF)
async function agregarCapaTexto(doc, ocr) {
  const { StandardFonts, pushGraphicsState, popGraphicsState, beginText, endText, setTextRenderingMode, TextRenderingMode,
    setFontAndSize, setCharacterSqueeze, setTextMatrix, showText } = PDFLib;
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  let nuevas = 0;
  for (const [n, palabras] of ocr) {
    const pg = doc.getPage(n - 1);
    pg.setFont(fuente);
    const ops = [pushGraphicsState(), beginText(), setTextRenderingMode(TextRenderingMode.Invisible)];
    for (const w of palabras) {
      const t = aWinAnsi(fuente, w.texto);
      if (!t.replace(/[?\s]/g, '').length && t.length > 1) continue;
      const natural = fuente.widthOfTextAtSize(t, w.size);
      if (!(natural > 0)) continue;
      const tz = Math.min(500, Math.max(10, (w.ancho / natural) * 100));
      const c = Math.cos(w.ang), s = Math.sin(w.ang);
      ops.push(setFontAndSize(pg.fontKey, w.size), setCharacterSqueeze(tz), setTextMatrix(c, s, -s, c, w.x, w.y), showText(fuente.encodeText(t)));
      nuevas++;
    }
    ops.push(endText(), popGraphicsState());
    pg.pushOperators(...ops);
  }
  return nuevas;
}

// Hace buscables las páginas dadas (por defecto, las escaneadas). opt: {ocr:'si'} para no preguntar.
// → {paginas:[n…], palabras} o null si no se hizo nada.
export async function hacerBuscable(paginas, opt = {}) {
  if (!E.pdf) { toast(t('convertir.abrirPrimero'), true); return null; }
  if (E.protegido) { toast(t('convertir.sinClave'), true, 6000); return null; }
  if (!(await verificarOcr(opt.idioma))) return null;
  const { doc, cerrar } = await fuenteDoc();
  const ocr = new Map(), omitidas = [], fallidas = []; let cancelar = false;
  try {
    let lista = paginas && paginas.length ? paginas : null;
    const explicita = !!lista, cacheLeer = new Map();
    if (!lista) {
      lista = [];
      const cache = new Map();
      for (let n = 1; n <= doc.numPages; n++) {
        progreso(t('convertir.buscandoEscaneadas'), n / doc.numPages);
        const pag = await doc.getPage(n);
        try { if (esEscaneada(await leerPagina(pag, cache))) lista.push(n); } finally { pag.cleanup(); }
      }
      finProgreso();
      if (!lista.length) { toast(t('convertir.sinEscaneadas'), false, 5000); return null; }
    }
    for (let i = 0; i < lista.length; i++) {
      if (cancelar) throw cancelacion();
      progreso(t('convertir.reconociendo', { i: i + 1, n: lista.length }), i / lista.length, () => { cancelar = true; });
      await pausa();
      const pag = await doc.getPage(lista[i]);
      try {
        // no apilar capas: una página que ya tiene texto no se vuelve a reconocer (las del modo automático ya se comprobaron)
        if (explicita && (await leerPagina(pag, cacheLeer)).letras >= 20) { omitidas.push(lista[i]); continue; }
        let r = null;
        try { r = await ocrDePagina(pag); } catch (e) { if (e && e.cancelado) throw e; console.warn('ocr', lista[i], e); }
        if (r) ocr.set(lista[i], palabrasEnPdf(r, pag)); else fallidas.push(lista[i]);
      } finally { pag.cleanup(); }
    }
  } catch (e) { finProgreso(); await cerrar(); throw e; }
  await cerrar();
  finProgreso();
  const total = [...ocr.values()].reduce((n, p) => n + p.length, 0);
  const avisos = [omitidas.length ? textoOmitidas(omitidas) : '', fallidas.length ? textoFallidas(fallidas) : ''].filter(Boolean).join(' ');
  if (!total) {
    toast(avisos && !fallidas.length ? avisos : (avisos ? avisos + ' ' : '') + t('convertir.noReconocido'), !!fallidas.length || !avisos, 7000);
    return null;
  }
  let palabras = 0;
  const ok = await cambiarDocumento(t('convertir.haciendoBuscable'), async (d) => { palabras = await agregarCapaTexto(d, ocr); });
  return ok ? { paginas: [...ocr.keys()], palabras, omitidas, fallidas, avisos } : null;
}

async function herrBuscable() {
  if (!listo()) return;
  if (!soloPrograma()) return;
  if (E.protegido) { toast(t('convertir.sinClave'), true, 6000); return; }
  const n = nPaginas();
  const modo = await elegir(t('convertir.buscableTitulo'), [
    { valor: 'auto', texto: t('convertir.modoAuto'), descripcion: t('convertir.modoAutoDesc') },
    { valor: 'todas', texto: t('convertir.modoTodas'), descripcion: tn('convertir.nPaginas', n) },
    { valor: 'algunas', texto: t('convertir.modoAlgunas') },
  ]);
  if (!modo) return;
  let paginas = null;
  if (modo === 'todas') paginas = todasLasPaginas();
  if (modo === 'algunas') { paginas = await pedirRangoPaginas(t('convertir.quePaginas'), n); if (!paginas) return; }
  try {
    const r = await hacerBuscable(paginas);
    if (r) toast(t('convertir.buscableListo') + (r.avisos ? ' ' + r.avisos : ''), !!r.fallidas.length, r.avisos ? 10000 : 7000);
  } catch (e) { errorAviso(e); }
}

// ================= texto del PDF =================
// Texto de todas las páginas. opt.ocr: 'si' | 'no' | undefined (pregunta si hay páginas escaneadas)
export async function textoCompleto(opt = {}) {
  const { doc, cerrar } = await fuenteDoc();
  const cache = new Map(); const partes = []; let decision = opt.ocr === 'si' ? true : opt.ocr === 'no' ? false : null;
  let cancelar = false;
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      if (cancelar) throw cancelacion();
      if (!opt.silencio) progreso(t('convertir.leyendo', { n, total: doc.numPages }), (n - 1) / doc.numPages, () => { cancelar = true; });
      await pausa();
      const pag = await doc.getPage(n);
      try {
        const info = await leerPagina(pag, cache);
        let lineas = info.lineas;
        if (esEscaneada(info)) {
          if (decision === null) {
            finProgreso();
            decision = await confirmar(t('convertir.escaneadaTitulo'), t('convertir.escaneadaTexto', { n }), t('convertir.reconocer'), t('convertir.omitirlas'));
            if (decision) decision = await verificarOcr();
          }
          if (decision) {
            let r = null;
            try { r = await ocrDePagina(pag); } catch (e) { console.warn('ocr', n, e); }
            if (r) lineas = lineasDeOcr(r); else if (opt.fallidas) opt.fallidas.push(n);
          }
        }
        partes.push(construirParrafos(lineas).map((p) => p.lineas.map((l) => l.texto).join('\n')).join('\n\n'));
      } finally { pag.cleanup(); }
    }
  } finally { await cerrar(); finProgreso(); }
  return partes.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function copiarAlPortapapeles(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch (_) { /* probar el método antiguo */ }
  const t = document.createElement('textarea'); t.value = texto; t.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* nada */ }
  t.remove(); return ok;
}
async function texto(accion) {
  if (!listo()) return;
  if (accion === 'guardar' && !soloPrograma()) return;
  let txt; const fallidas = [];
  try { txt = await textoCompleto({ fallidas }); } catch (e) { errorAviso(e); return; }
  const nota = fallidas.length ? ' ' + textoFallidas(fallidas) : '';
  if (!txt) { toast(t('convertir.sinTexto') + nota, true, 6000); return; }
  if (accion === 'copiar') {
    toast((await copiarAlPortapapeles(txt) ? t('convertir.copiado') : t('convertir.noCopiado')) + nota, !!nota, nota ? 9000 : 6000);
    return;
  }
  const bytes = new TextEncoder().encode('﻿' + txt.replace(/\n/g, '\r\n'));   // UTF-8 con BOM: Bloc de notas muestra bien las tildes
  const r = await pedir('guardarArchivo', { datos: aBase64(bytes), nombre: baseNombre() + '.txt', formato: 'txt' });
  if (r && r.ruta) toast(t('convertir.guardadoEn', { ruta: r.ruta }) + nota, !!nota, nota ? 9000 : 6000);
}

// ================= Word, Excel o PowerPoint a PDF =================
let office = null; // {word, excel, powerpoint} una vez consultado
async function consultarOffice() {
  if (!puente) return null;
  const r = await pedir('officeDisponible', {}, { tiempo: 20000 });
  office = r ? { word: !!r.word, excel: !!r.excel, powerpoint: !!r.powerpoint } : null;
  return office;
}
const hayOffice = (o) => !!o && (o.word || o.excel || o.powerpoint);
async function officeAPdf() {
  if (ocupado()) return;
  if (!puente) { toast(t('convertir.soloPrograma'), true, 5000); return; }
  const o = await consultarOffice();
  if (!hayOffice(o)) { await confirmar(t('convertir.officeSinTitulo'), t('convertir.officeSinMsg'), t('convertir.ocr.entendido'), t('convertir.ocr.cerrar')); return; }
  const unico = [o.word && 'Word', o.excel && 'Excel', o.powerpoint && 'PowerPoint'].filter(Boolean);
  const con = unico.length === 1 ? unico[0] : 'Office';
  progreso(t('convertir.convirtiendoCon', { con }));
  let r;
  try { r = await pedir('officeAPdf', {}, { tiempo: 8 * 60 * 1000 }); } finally { finProgreso(); }
  if (!r || !r.datos) return;
  const bytes = deBase64(r.datos), nombre = r.nombre || t('convertir.nombreDoc');
  if (!E.pdf) { await cargarPDF(bytes, nombre); return; }
  const que = await elegir(t('convertir.listoPdf'), [
    { valor: 'abrir', texto: t('convertir.abrirNuevo'), descripcion: t('convertir.abrirNuevoDesc') },
    { valor: 'agregar', texto: t('convertir.agregarFinal'), descripcion: t('convertir.agregarFinalDesc') },
  ]);
  if (que === 'abrir') {
    if (!(await descartarCambios())) return;
    await cargarPDF(bytes, nombre);
  } else if (que === 'agregar') {
    const n = await unirBytes([bytes], 'final', [nombre]);
    if (n) toast(tn('convertir.agregadas', n));
  }
}

// ---------- tarjetas en Herramientas ----------
const G = 'Convertir';   // identificador del grupo (lo traduce herramientas.js)
const descOffice = () => (puente && office && !hayOffice(office) ? t('convertir.officeSinDesc') : t('convertir.officeDesc'));
registrarHerramienta({ id: 'convertir-word', grupo: G, titulo: () => t('convertir.aWord'), descripcion: () => t('convertir.aWordDesc'), icono: 'word', accion: pdfAWord });
registrarHerramienta({ id: 'convertir-buscable', grupo: G, titulo: () => t('convertir.buscable'), descripcion: () => t('convertir.buscableDesc'), icono: 'ocr', accion: herrBuscable });
registrarHerramienta({ id: 'convertir-copiar', grupo: G, titulo: () => t('convertir.copiar'), descripcion: () => t('convertir.copiarDesc'), icono: 'copiar', accion: () => texto('copiar') });
registrarHerramienta({ id: 'convertir-txt', grupo: G, titulo: () => t('convertir.txt'), descripcion: () => t('convertir.txtDesc'), icono: 'documento', accion: () => texto('guardar') });
registrarHerramienta({ id: 'convertir-office', grupo: G, titulo: () => t('convertir.office'), descripcion: descOffice, icono: 'office', accion: officeAPdf, requierePdf: false });
registrarHerramienta({ id: 'convertir-imagen', grupo: G, titulo: () => t('convertir.imagen'), descripcion: () => t('convertir.imagenDesc'), icono: 'camara', accion: herrExportar });
registrarHerramienta({ id: 'convertir-imagenes-pdf', grupo: G, titulo: () => t('convertir.imagenesPdf'), descripcion: () => t('convertir.imagenesPdfDesc'), icono: 'imagen', accion: herrImagenes, requierePdf: false });

// Si no hay Office, la tarjeta lo dice desde el principio (la descripción se calcula al abrir el panel)
consultarOffice().then((o) => {
  if (puente && !hayOffice(o)) {
    registrarHerramienta({ id: 'convertir-office', grupo: G, titulo: () => t('convertir.office'), descripcion: descOffice, icono: 'office', accion: officeAPdf, requierePdf: false });
  }
}).catch(() => {});

// ganchos para pruebas (window.__fp)
window.__fp = Object.assign(window.__fp || {}, {
  estructuraWord: (paginas, opt) => estructuraWord(paginas, { ocr: 'no', ...(opt || {}) }),
  async ocrPagina(n) { const { doc, cerrar } = await fuenteDoc(); try { return await ocrDePagina(await doc.getPage(n)); } finally { await cerrar(); } },
  hacerBuscable: (paginas, idiomaDoc) => hacerBuscable(paginas, { ocr: 'si', idioma: idiomaDoc }),
  textoCompleto: (opt) => textoCompleto({ ocr: 'no', silencio: true, ...(opt || {}) }),
  pdfAWord, officeAPdf, consultarOffice,
});
