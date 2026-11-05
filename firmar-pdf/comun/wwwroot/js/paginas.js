// Fase 1 "Páginas": girar, borrar, reordenar, insertar en blanco, unir, imágenes a PDF, dividir, extraer y exportar a imagen.
// Las operaciones puras (sin diálogos) se exponen también en window.__fp para las pruebas.
import { E, emit } from './estado.js';
import { toast, elegir, pedirTexto, pedirRangoPaginas, confirmar, progreso, finProgreso, aBase64, deBase64 } from './util.js';
import { pedir, post } from './puente.js';
import { cambiarDocumento, bytesActuales, cargarPDF, recolectarBasura } from './documento.js';
import { pdfjsLib, OPC_PDF, pdfViewer } from './visor.js';
import { registrarHerramienta } from './herramientas.js';
import { asegurarOcultos } from './ocultos.js';
import { mostrarMiniaturas } from './herramientas.js';
import { mensajeError } from './guardar.js';
import { botones, avisarSucio } from './historial.js';
import { agregar, t, tn, idioma } from './i18n.js';

agregar({
  es: {
    'paginas.documento': 'documento',
    'paginas.documentoUnido': 'documento-unido',
    'paginas.imagenes': 'imagenes',
    'paginas.sufPag': 'pag',
    'paginas.sufExtracto': 'extracto',
    'paginas.imagenN': 'imagen {n}',
    'paginas.archivoN': 'archivo {n}',
    'paginas.ningunaElegida': 'No hay páginas elegidas.',
    'paginas.noExiste': 'La página {p} no existe.',
    'paginas.textoPag.1': 'la página {p}',
    'paginas.textoPag.n': 'las páginas {p}',
    'paginas.descGirar': 'Girando páginas',
    'paginas.descBorrar': 'Borrando páginas',
    'paginas.descMover': 'Moviendo páginas',
    'paginas.descSubir': 'Subiendo páginas',
    'paginas.descBajar': 'Bajando páginas',
    'paginas.descBlanco': 'Insertando página en blanco',
    'paginas.descUnir': 'Uniendo documentos',
    'paginas.noTodas': 'No se pueden borrar todas las páginas.',
    'paginas.destinoMal': 'Destino no válido.',
    'paginas.posicionMal': 'Posición no válida.',
    'paginas.ningunaImagen': 'Ninguna imagen se pudo usar.',
    'paginas.numeroMayor': 'Escriba un número mayor que cero.',
    'paginas.modoMal': 'Modo no válido.',
    'paginas.tiff': 'Las imágenes TIFF no se pueden usar; guárdelas como JPG.',
    'paginas.noUsar.1': 'No se pudo usar: {nombre}.',
    'paginas.noUsar.n': 'No se pudieron usar {n} imágenes.',
    'paginas.conClave': 'Se omitió porque tiene contraseña: {lista}. Quítele la contraseña y vuelva a intentar.',
    'paginas.guardadoEn': 'Guardado en {ruta}',
    'paginas.lote': '{et} {i} de {total}…',
    'paginas.loteGuardando': '{et} {i} de {total}… (guardando)',
    'paginas.etPagina': 'Página',
    'paginas.etArchivo': 'Archivo',
    'paginas.cancelado.1': 'Cancelado. Se guardó 1 archivo.',
    'paginas.cancelado.n': 'Cancelado. Se guardaron {n} archivos.',
    'paginas.canceladoNada': 'Cancelado. No se guardó nada.',
    'paginas.parcial': 'Solo se guardaron {n} de {total} archivos.',
    'paginas.parcialNada': 'No se pudo guardar.',
    'paginas.guardados.1': 'Se guardó 1 archivo.',
    'paginas.guardados.n': 'Se guardaron {n} archivos.',
    'paginas.preparandoImg': 'Preparando la imagen {i} de {total}…',
    'paginas.carpetaImagenes': 'Elija la carpeta donde guardar las imágenes',
    'paginas.carpetaArchivos': 'Elija la carpeta donde guardar los archivos',
    'paginas.marqueBorrar': 'Marque primero las páginas que quiere borrar.',
    'paginas.marqueGirar': 'Marque primero las páginas que quiere girar.',
    'paginas.marqueExtraer': 'Marque primero las páginas que quiere extraer.',
    'paginas.borrarTitulo': '¿Borrar páginas?',
    'paginas.borrarMsg': 'Se borrará {que}. Si se arrepiente, puede deshacerlo.',
    'paginas.borrarSi': 'Sí, borrar',
    'paginas.borrarNo': 'No, dejarlas',
    'paginas.preparando': 'Preparando el archivo…',
    'paginas.tamanoTitulo': '¿Qué tamaño de hoja?',
    'paginas.carta': 'Carta',
    'paginas.cartaDesc': 'La hoja más usada para imprimir',
    'paginas.a4': 'A4',
    'paginas.a4Desc': 'Hoja europea',
    'paginas.tamImagen': 'Tamaño de la imagen',
    'paginas.tamImagenDesc': 'La página queda igual a la imagen, sin márgenes',
    'paginas.uniendo': 'Uniendo documentos…',
    'paginas.otroAbierto': 'Se abrió otro documento mientras se preparaba la unión. No se unió nada; vuelva a intentarlo.',
    'paginas.ordene': 'Ordene las páginas arrastrándolas, si lo necesita.',
    'paginas.elegirArchivos': 'Elija los PDF o imágenes que quiere agregar',
    'paginas.dondeTitulo': '¿Dónde los agrega?',
    'paginas.alFinal': 'Al final',
    'paginas.alInicio': 'Al principio',
    'paginas.despues': 'Después de la página actual',
    'paginas.despuesDesc': 'Página {n}',
    'paginas.agregadas.1': 'Se agregó 1 página.',
    'paginas.agregadas.n': 'Se agregaron {n} páginas.',
    'paginas.elegirImagenes': 'Elija las imágenes',
    'paginas.queHacer': '¿Qué quiere hacer?',
    'paginas.crearNuevo': 'Crear un PDF nuevo',
    'paginas.crearNuevoDesc': 'El documento abierto no cambia',
    'paginas.agregarEste': 'Agregarlas a este PDF',
    'paginas.agregarEsteDesc': 'Quedan al final del documento',
    'paginas.creando': 'Creando el PDF…',
    'paginas.unaSola': 'Este PDF tiene una sola página.',
    'paginas.comoDividir': '¿Cómo quiere dividirlo?',
    'paginas.porPagina': 'Una página por archivo',
    'paginas.porPaginaDesc': 'Se crean {n} archivos',
    'paginas.rango': 'Elegir páginas para un archivo nuevo',
    'paginas.cada': 'Cada cierta cantidad de páginas',
    'paginas.cadaDesc': 'Por ejemplo, cada 5 páginas',
    'paginas.quePaginas': '¿Qué páginas?',
    'paginas.cadaTitulo': 'Cada cuántas páginas',
    'paginas.cadaEtiqueta': 'Cantidad de páginas por archivo',
    'paginas.dividiendo': 'Dividiendo el documento…',
    'paginas.quePaginasExtraer': '¿Qué páginas quiere extraer?',
    'paginas.quePaginasGirar': '¿Qué páginas quiere girar?',
    'paginas.quePaginasBorrar': '¿Qué páginas quiere borrar?',
    'paginas.haciaDonde': '¿Hacia dónde?',
    'paginas.derecha': 'A la derecha',
    'paginas.izquierda': 'A la izquierda',
    'paginas.mediaVuelta': 'Media vuelta',
    'paginas.formato': '¿En qué formato?',
    'paginas.jpgDesc': 'Archivo liviano, ideal para enviar',
    'paginas.pngDesc': 'Mejor calidad para textos',
    'paginas.calidad': '¿Qué calidad?',
    'paginas.normal': 'Normal (150 dpi)',
    'paginas.normalDesc': 'Rápido y liviano',
    'paginas.alta': 'Alta (300 dpi)',
    'paginas.altaDesc': 'Más nítido, archivos más pesados',
    'paginas.todas': 'Todas las páginas',
    'paginas.todasDesc': '{n} imágenes',
    'paginas.algunas': 'Solo algunas',
    'paginas.unir': 'Unir PDF',
    'paginas.unirDesc': 'Junte varios PDF o imágenes en un solo documento',
    'paginas.imgAPdf': 'Imágenes a PDF',
    'paginas.imgAPdfDesc': 'Convierta fotos en un documento PDF',
    'paginas.dividir': 'Dividir PDF',
    'paginas.dividirDesc': 'Separe el documento en varios archivos',
    'paginas.extraer': 'Extraer páginas',
    'paginas.extraerDesc': 'Guarde algunas páginas en un PDF nuevo',
    'paginas.girar': 'Girar páginas',
    'paginas.girarDesc': 'Dé vuelta páginas que están de lado',
    'paginas.borrar': 'Borrar páginas',
    'paginas.borrarDesc': 'Quite las páginas que no necesita',
    'paginas.exportar': 'Exportar a imagen',
    'paginas.exportarDesc': 'Guarde las páginas como fotos JPG o PNG',
  },
  en: {
    'paginas.documento': 'document',
    'paginas.documentoUnido': 'merged-document',
    'paginas.imagenes': 'images',
    'paginas.sufPag': 'page',
    'paginas.sufExtracto': 'extract',
    'paginas.imagenN': 'image {n}',
    'paginas.archivoN': 'file {n}',
    'paginas.ningunaElegida': 'No pages have been chosen.',
    'paginas.noExiste': 'Page {p} does not exist.',
    'paginas.textoPag.1': 'page {p}',
    'paginas.textoPag.n': 'pages {p}',
    'paginas.descGirar': 'Rotating pages',
    'paginas.descBorrar': 'Deleting pages',
    'paginas.descMover': 'Moving pages',
    'paginas.descSubir': 'Moving pages up',
    'paginas.descBajar': 'Moving pages down',
    'paginas.descBlanco': 'Inserting a blank page',
    'paginas.descUnir': 'Merging documents',
    'paginas.noTodas': 'You cannot delete every page.',
    'paginas.destinoMal': 'That destination is not valid.',
    'paginas.posicionMal': 'That position is not valid.',
    'paginas.ningunaImagen': 'None of the images could be used.',
    'paginas.numeroMayor': 'Please type a number greater than zero.',
    'paginas.modoMal': 'That option is not valid.',
    'paginas.tiff': 'TIFF images cannot be used. Please save them as JPG.',
    'paginas.noUsar.1': 'Could not use: {nombre}.',
    'paginas.noUsar.n': 'Could not use {n} images.',
    'paginas.conClave': 'Skipped because it has a password: {lista}. Please remove its password and try again.',
    'paginas.guardadoEn': 'Saved to {ruta}',
    'paginas.lote': '{et} {i} of {total}…',
    'paginas.loteGuardando': '{et} {i} of {total}… (saving)',
    'paginas.etPagina': 'Page',
    'paginas.etArchivo': 'File',
    'paginas.cancelado.1': 'Cancelled. 1 file was saved.',
    'paginas.cancelado.n': 'Cancelled. {n} files were saved.',
    'paginas.canceladoNada': 'Cancelled. Nothing was saved.',
    'paginas.parcial': 'Only {n} of {total} files were saved.',
    'paginas.parcialNada': 'Could not save.',
    'paginas.guardados.1': '1 file was saved.',
    'paginas.guardados.n': '{n} files were saved.',
    'paginas.preparandoImg': 'Preparing image {i} of {total}…',
    'paginas.carpetaImagenes': 'Choose the folder where the images will be saved',
    'paginas.carpetaArchivos': 'Choose the folder where the files will be saved',
    'paginas.marqueBorrar': 'First mark the pages you want to delete.',
    'paginas.marqueGirar': 'First mark the pages you want to rotate.',
    'paginas.marqueExtraer': 'First mark the pages you want to extract.',
    'paginas.borrarTitulo': 'Delete pages?',
    'paginas.borrarMsg': 'This will delete {que}. If you change your mind, you can undo it.',
    'paginas.borrarSi': 'Yes, delete',
    'paginas.borrarNo': 'No, keep them',
    'paginas.preparando': 'Preparing the file…',
    'paginas.tamanoTitulo': 'What paper size?',
    'paginas.carta': 'Letter',
    'paginas.cartaDesc': 'The most common sheet for printing',
    'paginas.a4': 'A4',
    'paginas.a4Desc': 'European paper size',
    'paginas.tamImagen': 'Same size as the image',
    'paginas.tamImagenDesc': 'The page matches the image, with no margins',
    'paginas.uniendo': 'Merging documents…',
    'paginas.otroAbierto': 'Another document was opened while the merge was being prepared. Nothing was merged. Please try again.',
    'paginas.ordene': 'If you need to, drag the pages to put them in order.',
    'paginas.elegirArchivos': 'Choose the PDFs or images you want to add',
    'paginas.dondeTitulo': 'Where do you want to add them?',
    'paginas.alFinal': 'At the end',
    'paginas.alInicio': 'At the beginning',
    'paginas.despues': 'After the current page',
    'paginas.despuesDesc': 'Page {n}',
    'paginas.agregadas.1': '1 page was added.',
    'paginas.agregadas.n': '{n} pages were added.',
    'paginas.elegirImagenes': 'Choose the images',
    'paginas.queHacer': 'What would you like to do?',
    'paginas.crearNuevo': 'Create a new PDF',
    'paginas.crearNuevoDesc': 'The open document stays the same',
    'paginas.agregarEste': 'Add them to this PDF',
    'paginas.agregarEsteDesc': 'They go at the end of the document',
    'paginas.creando': 'Creating the PDF…',
    'paginas.unaSola': 'This PDF has only one page.',
    'paginas.comoDividir': 'How do you want to split it?',
    'paginas.porPagina': 'One page per file',
    'paginas.porPaginaDesc': '{n} files will be created',
    'paginas.rango': 'Choose pages for a new file',
    'paginas.cada': 'Every certain number of pages',
    'paginas.cadaDesc': 'For example, every 5 pages',
    'paginas.quePaginas': 'Which pages?',
    'paginas.cadaTitulo': 'How many pages each',
    'paginas.cadaEtiqueta': 'Number of pages per file',
    'paginas.dividiendo': 'Splitting the document…',
    'paginas.quePaginasExtraer': 'Which pages do you want to extract?',
    'paginas.quePaginasGirar': 'Which pages do you want to rotate?',
    'paginas.quePaginasBorrar': 'Which pages do you want to delete?',
    'paginas.haciaDonde': 'Which way?',
    'paginas.derecha': 'To the right',
    'paginas.izquierda': 'To the left',
    'paginas.mediaVuelta': 'Half turn',
    'paginas.formato': 'Which format?',
    'paginas.jpgDesc': 'Small file, good for sending',
    'paginas.pngDesc': 'Better quality for text',
    'paginas.calidad': 'Which quality?',
    'paginas.normal': 'Normal (150 dpi)',
    'paginas.normalDesc': 'Quick and light',
    'paginas.alta': 'High (300 dpi)',
    'paginas.altaDesc': 'Sharper, but the files are larger',
    'paginas.todas': 'All pages',
    'paginas.todasDesc': '{n} images',
    'paginas.algunas': 'Only some',
    'paginas.unir': 'Merge PDFs',
    'paginas.unirDesc': 'Put several PDFs or images together in one document',
    'paginas.imgAPdf': 'Images to PDF',
    'paginas.imgAPdfDesc': 'Turn photos into a PDF document',
    'paginas.dividir': 'Split PDF',
    'paginas.dividirDesc': 'Separate the document into several files',
    'paginas.extraer': 'Extract pages',
    'paginas.extraerDesc': 'Save some pages in a new PDF',
    'paginas.girar': 'Rotate pages',
    'paginas.girarDesc': 'Turn pages that are sideways',
    'paginas.borrar': 'Delete pages',
    'paginas.borrarDesc': 'Remove the pages you do not need',
    'paginas.exportar': 'Export as images',
    'paginas.exportarDesc': 'Save the pages as JPG or PNG pictures',
  },
});

E.seleccionPaginas = []; // páginas marcadas en el panel de miniaturas (1, 2, 3…)

const MM = 72 / 25.4;
const HOJAS = { carta: [612, 792], a4: [595.28, 841.89] };
export const nPaginas = () => (E.pdf ? E.pdf.numPages : 0);
const baseNombre = () => (E.nombreActual || t('paginas.documento') + '.pdf').replace(/\.pdf$/i, '');
const lista = (p) => [...new Set(p)].filter((x) => Number.isInteger(x)).sort((a, b) => a - b);
function validar(paginas) {
  const n = nPaginas(), l = lista(paginas);
  if (!l.length) throw new Error(t('paginas.ningunaElegida'));
  for (const p of l) if (p < 1 || p > n) throw new Error(t('paginas.noExiste', { p }));
  return l;
}
const textoPaginas = (l) => tn('paginas.textoPag', l.length, { p: l.join(', ') });

// ================= operaciones sobre el documento abierto (con deshacer) =================
async function conSeleccion(nuevaSel, hacer) {
  const previa = E.seleccionPaginas; E.seleccionPaginas = nuevaSel;
  const ok = await hacer();
  if (!ok) { E.seleccionPaginas = previa; emit('seleccionPaginas'); }
  return ok;
}
// orden: números de página (de 1) en el orden nuevo; si falta alguna, esa página se borra.
// Vacía el valor de un campo (/V y /DV) y marca para regenerar la apariencia de los widgets que quedan.
function vaciarCampo(campo) {
  const { PDFName } = PDFLib;
  try {
    if (typeof campo.setText === 'function') campo.setText(undefined);
    else if (typeof campo.uncheck === 'function') campo.uncheck();
    else if (typeof campo.clear === 'function') campo.clear();
  } catch (e) { console.warn('vaciar campo', e); }
  try { campo.acroField.dict.delete(PDFName.of('V')); campo.acroField.dict.delete(PDFName.of('DV')); } catch (_) { /* nada */ }
  try { campo.markAsDirty(); } catch (_) { /* nada */ }
}
// Antes de quitar páginas: los campos de formulario que estaban solo en ellas se eliminan (si un campo tiene
// widgets en varias páginas, solo se quita el de la página borrada).
export function quitarCamposDe(doc, borradas, opt = {}) {
  const { PDFName } = PDFLib;
  if (!doc.catalog.has(PDFName.of('AcroForm'))) return;
  const ctx = doc.context, widgets = new Set();
  for (const pg of borradas) {
    const an = pg.node.Annots();
    if (an) for (let i = 0; i < an.size(); i++) { const r = an.get(i); if (r && r.tag) widgets.add(r.tag); }
  }
  if (!widgets.size) return;
  const form = doc.getForm();
  for (const campo of form.getFields()) {
    try {
      const ac = campo.acroField, ws = ac.getWidgets();
      const en = ws.map((w) => { const r = ctx.getObjectRef(w.dict); return !!(r && widgets.has(r.tag)); });
      if (!en.some(Boolean)) continue;
      if (en.every(Boolean)) {
        try { form.removeField(campo); } catch (_) { form.acroForm.removeField(ac); } // el respaldo deja el resto a recolectarBasura
      } else {
        for (let i = en.length - 1; i >= 0; i--) if (en[i]) ac.removeWidget(i);
        if (opt.limpiarValor) vaciarCampo(campo); // privacidad: el valor tapado no puede quedar en los widgets de otras páginas
      }
    } catch (e) { console.warn('campo', e); }
  }
}
// Marcadores, destinos con nombre, enlaces y acciones que apuntaban a una página borrada pasan a `destino` (primera página que queda).
export function redirigirDestinos(doc, tags, destino) {
  const { PDFRef, PDFArray } = PDFLib, ctx = doc.context;
  const ir = (o) => {
    if (!o || o instanceof PDFRef) return;
    if (o instanceof PDFArray) {
      if (o.size() && o.get(0) instanceof PDFRef && tags.has(o.get(0).tag)) o.set(0, destino);
      for (let i = 0; i < o.size(); i++) ir(o.get(i));
    } else if (o.dict) ir(o.dict);
    else if (typeof o.entries === 'function') for (const [, v] of o.entries()) ir(v);
  };
  for (const [, obj] of ctx.enumerateIndirectObjects()) ir(obj);
}
async function aplicarOrden(orden, desc, nuevaSel, irA) {
  const ok = await conSeleccion(nuevaSel, () => cambiarDocumento(desc, async (doc) => {
    const pags = doc.getPages();
    const quedan = new Set(orden), borradas = pags.filter((_, i) => !quedan.has(i + 1));
    if (borradas.length) { try { quitarCamposDe(doc, borradas); } catch (e) { console.warn('formulario', e); } }
    for (let i = pags.length - 1; i >= 0; i--) doc.removePage(i);
    for (const n of orden) doc.addPage(pags[n - 1]);
    if (borradas.length) {
      const tags = new Set(borradas.map((p) => p.ref.tag));
      try { redirigirDestinos(doc, tags, pags[orden[0] - 1].ref); } catch (e) { console.warn('destinos', e); }
      recolectarBasura(doc, tags); // pdf-lib no elimina los objetos de una página borrada: sin esto seguirían dentro del archivo
    }
  }));
  if (ok && irA) pdfViewer.currentPageNumber = Math.min(irA, pdfViewer.pagesCount);
  return ok;
}

export async function girar(paginas, grados) {
  const l = validar(paginas);
  return conSeleccion(l, () => cambiarDocumento(t('paginas.descGirar'), async (doc, PL) => {
    const pags = doc.getPages();
    for (const n of l) {
      const p = pags[n - 1];
      p.setRotation(PL.degrees((((p.getRotation().angle + grados) % 360) + 360) % 360));
    }
  }));
}
export async function borrar(paginas) {
  const l = validar(paginas), n = nPaginas();
  if (l.length >= n) throw new Error(t('paginas.noTodas'));
  const orden = []; for (let i = 1; i <= n; i++) if (!l.includes(i)) orden.push(i);
  return aplicarOrden(orden, t('paginas.descBorrar'), [], 0);
}
// Lleva las páginas elegidas delante de la página `antesDe` (1 a n+1, según la numeración actual).
export async function reordenar(paginas, antesDe) {
  const l = validar(paginas), n = nPaginas();
  if (!(antesDe >= 1 && antesDe <= n + 1)) throw new Error(t('paginas.destinoMal'));
  const resto = []; for (let i = 1; i <= n; i++) if (!l.includes(i)) resto.push(i);
  const pos = resto.filter((i) => i < antesDe).length;
  const orden = [...resto.slice(0, pos), ...l, ...resto.slice(pos)];
  if (orden.every((v, i) => v === i + 1)) return true;
  const nueva = l.map((_, i) => pos + i + 1);
  return aplicarOrden(orden, t('paginas.descMover'), nueva, nueva[0]);
}
// mover(desde, hasta): la página `desde` queda en la posición `hasta`.
export const mover = (desde, hasta) => reordenar([desde], hasta > desde ? hasta + 1 : hasta);
// Sube (-1) o baja (+1) un lugar las páginas elegidas.
export async function desplazar(paginas, delta) {
  const l = validar(paginas), n = nPaginas();
  const orden = []; for (let i = 1; i <= n; i++) orden.push(i);
  const sel = new Set(l);
  if (delta < 0) { for (let i = 1; i < n; i++) if (sel.has(orden[i]) && !sel.has(orden[i - 1])) [orden[i - 1], orden[i]] = [orden[i], orden[i - 1]]; }
  else { for (let i = n - 2; i >= 0; i--) if (sel.has(orden[i]) && !sel.has(orden[i + 1])) [orden[i], orden[i + 1]] = [orden[i + 1], orden[i]]; }
  if (orden.every((v, i) => v === i + 1)) return true;
  const nueva = orden.map((v, i) => (sel.has(v) ? i + 1 : 0)).filter(Boolean);
  return aplicarOrden(orden, delta < 0 ? t('paginas.descSubir') : t('paginas.descBajar'), nueva, nueva[0]);
}
// Página en blanco después de `despuesDe` (0 = al principio), del mismo tamaño que la vecina.
export async function insertarBlanco(despuesDe) {
  const n = nPaginas();
  if (!Number.isInteger(despuesDe) || despuesDe < 0 || despuesDe > n) throw new Error(t('paginas.posicionMal'));
  const ok = await conSeleccion([despuesDe + 1], () => cambiarDocumento(t('paginas.descBlanco'), async (doc) => {
    const ref = doc.getPage(Math.max(despuesDe, 1) - 1);
    const mb = ref.getMediaBox();
    const nueva = doc.insertPage(despuesDe, [mb.width, mb.height]);
    nueva.setRotation(ref.getRotation());
  }));
  if (ok) pdfViewer.currentPageNumber = despuesDe + 1;
  return ok;
}

// ================= imágenes =================
const esPdf = (u) => u.length > 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
function orientacionExif(u) { // 1 = normal; solo JPG
  if (u[0] !== 0xFF || u[1] !== 0xD8) return 1;
  let i = 2;
  while (i + 4 < u.length) {
    if (u[i] !== 0xFF) return 1;
    const m = u[i + 1], len = (u[i + 2] << 8) | u[i + 3];
    if (m === 0xE1 && u[i + 4] === 0x45 && u[i + 5] === 0x78) { // "Ex"if
      const t = i + 10, le = u[t] === 0x49;
      const r16 = (o) => (le ? u[o] | (u[o + 1] << 8) : (u[o] << 8) | u[o + 1]);
      const r32 = (o) => (le ? (u[o] | (u[o + 1] << 8) | (u[o + 2] << 16) | (u[o + 3] << 24)) : ((u[o] << 24) | (u[o + 1] << 16) | (u[o + 2] << 8) | u[o + 3])) >>> 0;
      const ifd = t + r32(t + 4), cant = r16(ifd);
      for (let k = 0; k < cant; k++) { const e = ifd + 2 + k * 12; if (r16(e) === 0x0112) return r16(e + 8) || 1; }
      return 1;
    }
    if (m === 0xDA) return 1;
    i += 2 + len;
  }
  return 1;
}
// Tamaño en píxeles leído de la cabecera (PNG y JPG), sin decodificar la imagen. null si no se reconoce.
function dimensiones(u) {
  if (u[0] === 0x89 && u[1] === 0x50 && u.length > 24) {
    const r = (o) => ((u[o] << 24) | (u[o + 1] << 16) | (u[o + 2] << 8) | u[o + 3]) >>> 0;
    return { w: r(16), h: r(20) };
  }
  if (u[0] === 0xFF && u[1] === 0xD8) {
    let i = 2;
    while (i + 9 < u.length) {
      if (u[i] !== 0xFF) { i++; continue; }
      const m = u[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: (u[i + 5] << 8) | u[i + 6], w: (u[i + 7] << 8) | u[i + 8] };
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7) || m === 0xFF) { i += m === 0xFF ? 1 : 2; continue; }
      i += 2 + ((u[i + 2] << 8) | u[i + 3]);
    }
  }
  return null;
}
const LADO_MAX = 8000, PIXELES_MAX = 40e6, LADO_REDUCIDO = 6000, PAGINA_MAX_PT = 14400;
const esEnorme = (d) => !!d && (Math.max(d.w, d.h) > LADO_MAX || d.w * d.h > PIXELES_MAX);
const aBlob = (canvas, tipo, q) => new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('imagen'))), tipo, q));
// Decodifica con el navegador (respeta EXIF) y devuelve bytes JPG o PNG listos para incrustar.
// dim: tamaño conocido de una imagen enorme; se decodifica ya reducida (a lo más LADO_REDUCIDO px de lado) para no gastar memoria.
async function reconvertir(u, forzarPng, dim) {
  let bmp;
  const opc = { imageOrientation: 'from-image' };
  if (dim && esEnorme(dim)) {
    const k = Math.min(1, LADO_REDUCIDO / Math.max(dim.w, dim.h), Math.sqrt(PIXELES_MAX / (dim.w * dim.h)));
    opc.resizeWidth = Math.max(1, Math.round(dim.w * k)); opc.resizeHeight = Math.max(1, Math.round(dim.h * k)); opc.resizeQuality = 'high';
  }
  try { bmp = await createImageBitmap(new Blob([u]), opc); }
  catch (_) { const e = new Error('formato'); e.codigo = 'formato'; throw e; }
  try {
    let bw = bmp.width, bh = bmp.height;
    const kk = Math.min(1, LADO_REDUCIDO / Math.max(bw, bh)); // respaldo si el navegador no redujo
    if (kk < 1 && Math.max(bw, bh) > LADO_MAX) { bw = Math.round(bw * kk); bh = Math.round(bh * kk); }
    const c = document.createElement('canvas'); c.width = bw; c.height = bh;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0, bw, bh);
    let alfa = !!forzarPng;
    if (!alfa) { const d = ctx.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { alfa = true; break; } }
    const b = await aBlob(c, alfa ? 'image/png' : 'image/jpeg', 0.9);
    c.width = c.height = 0;
    return { bytes: new Uint8Array(await b.arrayBuffer()), png: alfa };
  } finally { bmp.close && bmp.close(); }
}
export async function incrustar(doc, u) {
  const dim = dimensiones(u);
  if (esEnorme(dim)) { // imagen enorme: se reduce antes de incrustar (sin transparencia → JPG; con transparencia → PNG)
    const r = await reconvertir(u, false, dim);
    return r.png ? doc.embedPng(r.bytes) : doc.embedJpg(r.bytes);
  }
  if (u[0] === 0xFF && u[1] === 0xD8) {
    if (orientacionExif(u) <= 1) return doc.embedJpg(u);
    return doc.embedJpg((await reconvertir(u, false)).bytes);
  }
  if (u[0] === 0x89 && u[1] === 0x50) {
    try { return await doc.embedPng(u); } catch (_) { return doc.embedPng((await reconvertir(u, true)).bytes); }
  }
  const r = await reconvertir(u, false);
  return r.png ? doc.embedPng(r.bytes) : doc.embedJpg(r.bytes);
}
// Agrega una página con la imagen. tamano: 'carta' | 'a4' | 'imagen'
async function paginaDeImagen(doc, u, tamano) {
  const img = await incrustar(doc, u);
  const w = img.width, h = img.height;
  let pw, ph, m = 0;
  if (tamano === 'imagen') { // tamaño de la imagen, con un tope para que la página siga siendo usable
    const k = Math.min(0.75, PAGINA_MAX_PT / Math.max(w, h)); pw = w * k; ph = h * k;
  }
  else { [pw, ph] = HOJAS[tamano] || HOJAS.carta; if (w > h) [pw, ph] = [ph, pw]; m = 10 * MM; }
  const s = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h);
  const dw = w * s, dh = h * s;
  const pag = doc.addPage([pw, ph]);
  pag.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
}
// → {doc, omitidos:[nombre], tiff:boolean}
async function documentoDeImagenes(arr, tamano, nombres = []) {
  const doc = await PDFLib.PDFDocument.create(), omitidos = []; let tiff = false;
  for (let i = 0; i < arr.length; i++) {
    const nombre = nombres[i] || t('paginas.imagenN', { n: i + 1 });
    try { await paginaDeImagen(doc, arr[i], tamano); }
    catch (e) {
      console.warn('imagen omitida', nombre, e); omitidos.push(nombre);
      if (/\.tiff?$/i.test(nombre) || (arr[i][0] === 0x49 && arr[i][1] === 0x49) || (arr[i][0] === 0x4D && arr[i][1] === 0x4D)) tiff = true;
    }
  }
  return { doc, omitidos, tiff };
}
export async function imagenesAPdf(arr, tamano = 'carta') {
  const { doc } = await documentoDeImagenes(arr, tamano);
  if (!doc.getPageCount()) throw new Error(t('paginas.ningunaImagen'));
  return doc.save();
}
function avisarOmitidas(omitidos, tiff) {
  if (!omitidos.length) return;
  toast(tiff ? t('paginas.tiff') : tn('paginas.noUsar', omitidos.length, { nombre: omitidos[0] }), true, 7000);
}

// ================= unir =================
// arr: Uint8Array de PDF o de imágenes (se reconoce por su contenido). donde: 'final' | 'inicio' | 'despues'.
// Devuelve la cantidad de páginas agregadas (0 si nada se pudo usar).
// Abre cada archivo (PDF o imagen) como documento de pdf-lib; avisa de los que no se pudieron usar.
async function prepararFuentes(arr, nombres, tamano) {
  const fuentes = [], omitidos = [], conClave = []; let tiff = false;
  for (let i = 0; i < arr.length; i++) {
    const nombre = nombres[i] || t('paginas.archivoN', { n: i + 1 });
    try {
      if (esPdf(arr[i])) fuentes.push(await PDFLib.PDFDocument.load(arr[i], { updateMetadata: false }));
      else {
        const r = await documentoDeImagenes([arr[i]], tamano, [nombre]);
        if (r.omitidos.length) { omitidos.push(nombre); tiff = tiff || r.tiff; } else fuentes.push(r.doc);
      }
    } catch (e) {
      console.warn('omitido', nombre, e);
      omitidos.push(nombre); if (/encrypt/i.test(String(e && e.message))) conClave.push(nombre);
    }
  }
  if (omitidos.length && !tiff) {
    if (conClave.length) toast(t('paginas.conClave', { lista: conClave.join(', ') }), true, 8000);
    else avisarOmitidas(omitidos, false);
  } else avisarOmitidas(omitidos, tiff);
  return fuentes;
}
export async function unirBytes(arr, donde = 'final', nombres = [], tamano = 'carta') {
  const fuentes = await prepararFuentes(arr, nombres, tamano);
  if (!fuentes.length) return 0;
  let agregadas = 0;
  const ok = await conSeleccion([], () => cambiarDocumento(t('paginas.descUnir'), async (doc) => {
    let idx = donde === 'inicio' ? 0 : donde === 'despues' ? Math.min(pdfViewer.currentPageNumber, doc.getPageCount()) : doc.getPageCount();
    for (const src of fuentes) {
      const copias = await doc.copyPages(src, src.getPageIndices());
      for (const p of copias) { doc.insertPage(idx++, p); agregadas++; }
    }
  }));
  return ok ? agregadas : 0;
}

// ================= dividir / extraer =================
async function fuenteActual() { return PDFLib.PDFDocument.load(await bytesActuales(), { updateMetadata: false }); }
async function crearSub(src, g) {
  const d = await PDFLib.PDFDocument.create();
  const copias = await d.copyPages(src, g.map((n) => n - 1));
  copias.forEach((p) => d.addPage(p));
  return d.save();
}
async function subdocumentos(grupos) { // grupos: arreglos de números de página → Uint8Array[]
  const src = await fuenteActual(), res = [];
  for (const g of grupos) res.push(await crearSub(src, g));
  return res;
}
function gruposDe(modo, param) {
  const n = nPaginas();
  if (modo === 'una') return Array.from({ length: n }, (_, i) => [i + 1]);
  if (modo === 'rango') return [validar(Array.isArray(param) ? param : [param])];
  if (modo === 'cada') {
    const k = Math.floor(+param);
    if (!(k >= 1)) throw new Error(t('paginas.numeroMayor'));
    const g = []; for (let i = 1; i <= n; i += k) g.push(Array.from({ length: Math.min(k, n - i + 1) }, (_, j) => i + j));
    return g;
  }
  throw new Error(t('paginas.modoMal'));
}
export async function dividir(modo, param) { return subdocumentos(gruposDe(modo, param)); }
const nombreGrupo = (modo, g) => {
  const pg = t('paginas.sufPag');
  const sufijo = modo === 'una' ? `${pg}-${g[0]}` : modo === 'rango' ? t('paginas.sufExtracto') : (g.length === 1 ? `${pg}-${g[0]}` : `${pg}-${g[0]}-${g[g.length - 1]}`);
  return `${baseNombre()}-${sufijo}.pdf`;
};
async function guardarPdfs(archivos) {
  const r = await pedir('guardarArchivo', { datos: aBase64(archivos[0].datos), nombre: archivos[0].nombre, formato: 'pdf' });
  if (r) toast(t('paginas.guardadoEn', { ruta: r.ruta }), false, 6000);
  return !!r;
}

// Guarda muchos archivos en una carpeta sin acumularlos en memoria: elige la carpeta primero, genera uno a uno con
// producir(i) → {nombre, datos: Uint8Array} y los envía a C# en lotes de a lo más 25 MB (base64). Con progreso y "Cancelar".
// Devuelve cuántos archivos se escribieron (null si no se eligió carpeta).
const LOTE_MAX = 25 * 1024 * 1024;
export async function guardarEnCarpeta(titulo, total, etiqueta, producir, cerrar) {
  const c = await pedir('elegirCarpeta', { titulo });
  if (!c || !c.ruta) return null;
  let cancelado = false, fallo = false; const cancelar = () => { cancelado = true; };
  const escritos = []; let lote = [], bytes = 0;
  const pausa = () => new Promise((r) => setTimeout(r, 0));
  const enviar = async (i) => {
    if (!lote.length) return;
    progreso(t('paginas.loteGuardando', { et: etiqueta, i, total }), i / total, cancelar); await pausa();
    const archivos = lote.map((a) => ({ nombre: a.nombre, datos: aBase64(a.datos) }));
    lote = []; bytes = 0;
    progreso(t('paginas.loteGuardando', { et: etiqueta, i, total }), i / total, cancelar); await pausa();
    const r = await pedir('escribirEnCarpeta', { carpeta: c.ruta, archivos });
    if (!r || r.error) { fallo = true; if (r && r.error) toast(String(r.error), true, 7000); return; }
    escritos.push(...(r.escritos && r.escritos.length ? r.escritos : archivos.map((a) => a.nombre)));
  };
  try {
    for (let i = 0; i < total && !cancelado && !fallo; i++) {
      progreso(t('paginas.lote', { et: etiqueta, i: i + 1, total }), i / total, cancelar); await pausa();
      const a = await producir(i);
      const tam = Math.ceil(a.datos.length * 4 / 3);
      if (lote.length && bytes + tam > LOTE_MAX) await enviar(i);
      lote.push(a); bytes += tam;
      if (bytes >= LOTE_MAX) await enviar(i + 1);
    }
    if (!fallo) await enviar(total);
  } finally { if (cerrar) { try { await cerrar(); } catch (_) { /* nada */ } } finProgreso(); }
  if (escritos.length) post({ tipo: 'abrirCarpeta', carpeta: c.ruta });
  const n = escritos.length;
  if (cancelado) toast(n ? tn('paginas.cancelado', n) : t('paginas.canceladoNada'), false, 6000);
  else if (fallo) toast(n ? t('paginas.parcial', { n, total }) : t('paginas.parcialNada'), true, 7000);
  else toast(tn('paginas.guardados', n), false, 6000);
  return n;
}

// ================= exportar a imagen =================
// formato 'jpg' | 'png'; dpi 150 | 300; paginas: arreglo (por defecto todas) → Uint8Array[]
async function abrirRenderizador(formato, dpi) {
  const tarea = pdfjsLib.getDocument({ data: await bytesActuales(), ...OPC_PDF });
  let doc;
  try { doc = await tarea.promise; } catch (e) { try { tarea.destroy(); } catch (_) { /* nada */ } throw e; }
  return {
    async imagen(n) {
      const pag = await doc.getPage(n);
      const v1 = pag.getViewport({ scale: 1 });
      let esc = dpi / 72; const mayor = Math.max(v1.width, v1.height) * esc;
      if (mayor > 6000) esc = esc * 6000 / mayor;
      const vp = pag.getViewport({ scale: esc });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      try {
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await pag.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
        const b = await aBlob(c, formato === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
        return new Uint8Array(await b.arrayBuffer());
      } finally { c.width = c.height = 0; pag.cleanup(); }
    },
    async cerrar() { try { await tarea.destroy(); } catch (_) { /* nada */ } },
  };
}
// formato 'jpg' | 'png'; dpi 150 | 300; paginas: arreglo (por defecto todas) → Uint8Array[] (todo en memoria: para pocas páginas)
export async function exportarImagenes(formato = 'png', dpi = 150, paginas) {
  const todas = Array.from({ length: nPaginas() }, (_, i) => i + 1);
  const l = paginas && paginas.length ? validar(paginas) : todas;
  const res = []; let r = null;
  try {
    r = await abrirRenderizador(formato, dpi);
    for (let i = 0; i < l.length; i++) {
      progreso(t('paginas.preparandoImg', { i: i + 1, total: l.length }), i / l.length);
      await new Promise((x) => setTimeout(x, 0));
      res.push(await r.imagen(l[i]));
    }
  } finally { finProgreso(); if (r) await r.cerrar(); }
  return res;
}
// Exporta varias páginas a una carpeta, una a una (sin acumular todo en memoria).
export async function exportarACarpeta(formato, dpi, paginas) {
  const l = validar(paginas), b = baseNombre(); let r = null;
  return guardarEnCarpeta(t('paginas.carpetaImagenes'), l.length, t('paginas.etPagina'), async (i) => {
    if (!r) r = await abrirRenderizador(formato, dpi);
    return { nombre: `${b}-${t('paginas.sufPag')}-${l[i]}.${formato}`, datos: await r.imagen(l[i]) };
  }, () => r && r.cerrar());
}
// Divide el documento en varios PDF dentro de una carpeta, uno a uno.
export async function dividirACarpeta(modo, param) {
  const grupos = gruposDe(modo, param); let src = null;
  return guardarEnCarpeta(t('paginas.carpetaArchivos'), grupos.length, t('paginas.etArchivo'), async (i) => {
    if (!src) src = await fuenteActual();
    return { nombre: nombreGrupo(modo, grupos[i]), datos: await crearSub(src, grupos[i]) };
  });
}

// ================= herramientas (con diálogos) =================
const panelVisible = () => document.body.classList.contains('con-miniaturas');
async function paginasElegidas(titulo) {
  if (panelVisible() && E.seleccionPaginas.length) return lista(E.seleccionPaginas);
  return pedirRangoPaginas(titulo, nPaginas());
}
const aviso = (e) => { finProgreso(); if (e && e.cancelado) return; console.error(e); toast(mensajeError(e), true, 6000); };

export async function accionBorrar(paginas) {
  const l = lista(paginas), n = nPaginas();
  if (!l.length) { toast(t('paginas.marqueBorrar'), true); return; }
  if (l.length >= n) { toast(t('paginas.noTodas'), true, 5000); return; }
  if (!(await confirmar(t('paginas.borrarTitulo'), t('paginas.borrarMsg', { que: textoPaginas(l) }), t('paginas.borrarSi'), t('paginas.borrarNo')))) return;
  try { await borrar(l); } catch (e) { aviso(e); }
}
export async function accionGirar(paginas, grados) {
  const l = lista(paginas); if (!l.length) { toast(t('paginas.marqueGirar'), true); return; }
  try { await girar(l, grados); } catch (e) { aviso(e); }
}
export async function accionExtraer(paginas) {
  const l = lista(paginas); if (!l.length) { toast(t('paginas.marqueExtraer'), true); return; }
  try {
    progreso(t('paginas.preparando'));
    const [d] = await subdocumentos([l]); finProgreso();
    await guardarPdfs([{ nombre: `${baseNombre()}-${t('paginas.sufExtracto')}.pdf`, datos: d }]);
  } catch (e) { aviso(e); }
}

async function elegirTamano() {
  return elegir(t('paginas.tamanoTitulo'), [
    { valor: 'carta', texto: t('paginas.carta'), descripcion: t('paginas.cartaDesc') },
    { valor: 'a4', texto: t('paginas.a4'), descripcion: t('paginas.a4Desc') },
    { valor: 'imagen', texto: t('paginas.tamImagen'), descripcion: t('paginas.tamImagenDesc') },
  ]);
}

// Sin documento abierto: une varios PDF e imágenes (en orden de nombre) en un documento nuevo y abre las miniaturas.
export async function unirEnNuevo(arr, nombres = [], tamano = 'carta') {
  const orden = arr.map((_, i) => i).sort((a, b) => String(nombres[a] || '').localeCompare(String(nombres[b] || ''), idioma(), { numeric: true, sensitivity: 'base' }));
  progreso(t('paginas.uniendo'));
  try {
    const fuentes = await prepararFuentes(orden.map((i) => arr[i]), orden.map((i) => nombres[i] || t('paginas.archivoN', { n: i + 1 })), tamano);
    if (!fuentes.length) { finProgreso(); return 0; }
    const doc = await PDFLib.PDFDocument.create();
    for (const src of fuentes) for (const p of await doc.copyPages(src, src.getPageIndices())) doc.addPage(p);
    const bytes = await doc.save(); finProgreso();
    if (E.pdf) { toast(t('paginas.otroAbierto'), true, 6000); return 0; }
    if (!(await cargarPDF(bytes, t('paginas.documentoUnido') + '.pdf'))) return 0;
    E.guardadoIdx = -1; botones(); avisarSucio(); // el documento unido aún no está guardado en ningún archivo
    mostrarMiniaturas(true);
    toast(t('paginas.ordene'), false, 6000);
    return doc.getPageCount();
  } catch (e) { finProgreso(); throw e; }
}
async function herrUnir() {
  const sinPdf = !E.pdf;
  const r = await pedir('abrirArchivos', { tipos: 'pdf+imagenes', multiple: true, titulo: t('paginas.elegirArchivos') });
  if (!r || !r.lista || !r.lista.length) return;
  if (sinPdf) {
    if (E.pdf) return; // se abrió otro documento mientras se elegían los archivos
    try {
      const datos = r.lista.map((a) => deBase64(a.datos));
      let tam = 'carta';
      if (datos.some((u) => !esPdf(u))) { tam = await elegirTamano(); if (!tam) return; }
      await unirEnNuevo(datos, r.lista.map((a) => a.nombre), tam);
    } catch (e) { aviso(e); }
    return;
  }
  const donde = await elegir(t('paginas.dondeTitulo'), [
    { valor: 'final', texto: t('paginas.alFinal') }, { valor: 'inicio', texto: t('paginas.alInicio') },
    { valor: 'despues', texto: t('paginas.despues'), descripcion: t('paginas.despuesDesc', { n: pdfViewer.currentPageNumber }) },
  ]);
  if (!donde) return;
  try {
    const n = await unirBytes(r.lista.map((a) => deBase64(a.datos)), donde, r.lista.map((a) => a.nombre));
    if (n) toast(tn('paginas.agregadas', n));
  } catch (e) { aviso(e); }
}
export async function herrImagenes() {
  const r = await pedir('abrirArchivos', { tipos: 'imagenes', multiple: true, titulo: t('paginas.elegirImagenes') });
  if (!r || !r.lista || !r.lista.length) return;
  let destino = 'nuevo';
  if (E.pdf) {
    destino = await elegir(t('paginas.queHacer'), [
      { valor: 'nuevo', texto: t('paginas.crearNuevo'), descripcion: t('paginas.crearNuevoDesc') },
      { valor: 'agregar', texto: t('paginas.agregarEste'), descripcion: t('paginas.agregarEsteDesc') },
    ]);
    if (!destino) return;
  }
  const tam = await elegirTamano(); if (!tam) return;
  try {
    const datos = r.lista.map((a) => deBase64(a.datos)), nombres = r.lista.map((a) => a.nombre);
    if (destino === 'agregar') {
      const n = await unirBytes(datos, 'final', nombres, tam);
      if (n) toast(tn('paginas.agregadas', n));
      return;
    }
    progreso(t('paginas.creando'));
    const { doc, omitidos, tiff } = await documentoDeImagenes(datos, tam, nombres);
    if (!doc.getPageCount()) { finProgreso(); avisarOmitidas(omitidos, tiff); return; }
    const bytes = await doc.save(); finProgreso();
    avisarOmitidas(omitidos, tiff);
    if (!E.pdf) await cargarPDF(bytes, t('paginas.imagenes') + '.pdf');
    else await guardarPdfs([{ nombre: t('paginas.imagenes') + '.pdf', datos: bytes }]);
  } catch (e) { aviso(e); }
}
async function herrDividir() {
  const n = nPaginas();
  if (n < 2) { toast(t('paginas.unaSola'), true); return; }
  if (!(await asegurarOcultos())) return;
  const modo = await elegir(t('paginas.comoDividir'), [
    { valor: 'una', texto: t('paginas.porPagina'), descripcion: t('paginas.porPaginaDesc', { n }) },
    { valor: 'rango', texto: t('paginas.rango') },
    { valor: 'cada', texto: t('paginas.cada'), descripcion: t('paginas.cadaDesc') },
  ]);
  if (!modo) return;
  let param = null;
  if (modo === 'rango') { param = await pedirRangoPaginas(t('paginas.quePaginas'), n); if (!param) return; }
  if (modo === 'cada') {
    const txt = await pedirTexto(t('paginas.cadaTitulo'), t('paginas.cadaEtiqueta'), '5', {
      tipo: 'number', validar: (v) => (Math.floor(+v) >= 1 ? null : t('paginas.numeroMayor')),
    });
    if (txt === null) return; param = Math.floor(+txt);
  }
  try {
    const grupos = gruposDe(modo, param);
    if (grupos.length === 1) { // un solo archivo: diálogo Guardar como
      progreso(t('paginas.dividiendo'));
      const [d] = await subdocumentos(grupos); finProgreso();
      await guardarPdfs([{ nombre: nombreGrupo(modo, grupos[0]), datos: d }]);
    } else await dividirACarpeta(modo, param);
  } catch (e) { aviso(e); }
}
async function herrExtraer() {
  const n = nPaginas();
  const l = await pedirRangoPaginas(t('paginas.quePaginasExtraer'), n); if (!l) return;
  await accionExtraer(l);
}
async function herrGirar() {
  const l = await paginasElegidas(t('paginas.quePaginasGirar')); if (!l) return;
  const g = await elegir(t('paginas.haciaDonde'), [
    { valor: 90, texto: t('paginas.derecha') }, { valor: -90, texto: t('paginas.izquierda') }, { valor: 180, texto: t('paginas.mediaVuelta') },
  ]);
  if (g === null) return;
  await accionGirar(l, g);
}
async function herrBorrar() {
  const l = await paginasElegidas(t('paginas.quePaginasBorrar')); if (!l) return;
  await accionBorrar(l);
}
export async function herrExportar() {
  if (!(await asegurarOcultos())) return;
  const formato = await elegir(t('paginas.formato'), [
    { valor: 'jpg', texto: 'JPG', descripcion: t('paginas.jpgDesc') },
    { valor: 'png', texto: 'PNG', descripcion: t('paginas.pngDesc') },
  ]); if (!formato) return;
  const dpi = await elegir(t('paginas.calidad'), [
    { valor: 150, texto: t('paginas.normal'), descripcion: t('paginas.normalDesc') },
    { valor: 300, texto: t('paginas.alta'), descripcion: t('paginas.altaDesc') },
  ]); if (!dpi) return;
  const n = nPaginas(); let pags = null;
  if (n > 1) {
    const cuales = await elegir(t('paginas.quePaginas'), [
      { valor: 'todas', texto: t('paginas.todas'), descripcion: t('paginas.todasDesc', { n }) }, { valor: 'algunas', texto: t('paginas.algunas') },
    ]); if (!cuales) return;
    if (cuales === 'algunas') { pags = await pedirRangoPaginas(t('paginas.quePaginas'), n); if (!pags) return; }
  }
  try {
    const l = pags || Array.from({ length: n }, (_, i) => i + 1);
    const b = baseNombre();
    if (l.length === 1) {
      const [img] = await exportarImagenes(formato, dpi, l);
      const r = await pedir('guardarArchivo', { datos: aBase64(img), nombre: `${b}-${t('paginas.sufPag')}-${l[0]}.${formato}`, formato });
      if (r) toast(t('paginas.guardadoEn', { ruta: r.ruta }), false, 6000);
    } else await exportarACarpeta(formato, dpi, l);
  } catch (e) { aviso(e); }
}

registrarHerramienta({ id: 'unir', grupo: 'Páginas', titulo: () => t('paginas.unir'), descripcion: () => t('paginas.unirDesc'), icono: 'mas', accion: herrUnir, requierePdf: false });
registrarHerramienta({ id: 'imagenes-a-pdf', grupo: 'Páginas', titulo: () => t('paginas.imgAPdf'), descripcion: () => t('paginas.imgAPdfDesc'), icono: 'imagen', accion: herrImagenes, requierePdf: false });
registrarHerramienta({ id: 'dividir', grupo: 'Páginas', titulo: () => t('paginas.dividir'), descripcion: () => t('paginas.dividirDesc'), icono: 'dividir', accion: herrDividir });
registrarHerramienta({ id: 'extraer', grupo: 'Páginas', titulo: () => t('paginas.extraer'), descripcion: () => t('paginas.extraerDesc'), icono: 'extraer', accion: herrExtraer });
registrarHerramienta({ id: 'girar', grupo: 'Páginas', titulo: () => t('paginas.girar'), descripcion: () => t('paginas.girarDesc'), icono: 'girar', accion: herrGirar });
registrarHerramienta({ id: 'borrar', grupo: 'Páginas', titulo: () => t('paginas.borrar'), descripcion: () => t('paginas.borrarDesc'), icono: 'tachito', accion: herrBorrar });
registrarHerramienta({ id: 'exportar-imagen', grupo: 'Páginas', titulo: () => t('paginas.exportar'), descripcion: () => t('paginas.exportarDesc'), icono: 'camara', accion: herrExportar });

window.__fp = window.__fp || {};
Object.assign(window.__fp, { unirBytes, unirEnNuevo, imagenesAPdf, dividir, exportarImagenes, exportarACarpeta, dividirACarpeta, guardarEnCarpeta, paginaDeImagen: (u, t) => documentoDeImagenes([u], t), girar, borrar, mover, insertarBlanco, reordenar, desplazar });
