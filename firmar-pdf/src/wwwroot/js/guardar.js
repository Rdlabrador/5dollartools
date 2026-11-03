// Guardar e imprimir: construye el PDF final con los elementos colocados.
import { E } from './estado.js';
import { $, toast, mostrarCarga, ocultarCarga, abrirModal, cerrarModal, ocupado, aBase64, deBase64, descargar, msgSimbolos } from './util.js';
import { agregar, t } from './i18n.js';
import { post, puente, alMensaje } from './puente.js';
import { pdfViewer } from './visor.js';
import { cargarPDF, recolectarBasura } from './documento.js';
import { dibujarAnotacion } from './dibujo.js';
import { asegurarOcultos } from './ocultos.js';

agregar({
  es: {
    'guardar.sinClave': 'Este archivo se guardará SIN contraseña. Para protegerlo use Herramientas → Poner contraseña.',
    'guardar.sufijo': '-firmado',
    'guardar.versionFinalFallo': 'No se pudo crear la versión final de este formulario.',
    'guardar.protegidoGuardar': 'Este PDF está protegido y no se puede guardar con cambios.',
    'guardar.noPreparado': 'No se pudo preparar el archivo. ',
    'guardar.protegido': 'Este PDF está protegido: no se puede guardar con cambios.',
    'guardar.preparandoFinal': 'Preparando la versión final…',
    'guardar.guardando': 'Guardando…',
    'guardar.guardadoSimbolos': 'Guardado. {msg}',
    'guardar.guardadoDescargas': 'Guardado en la carpeta de descargas.',
    'guardar.preparandoImpresion': 'Preparando la impresión…',
    'guardar.ventanaBloqueada': 'El navegador bloqueó la ventana de impresión.',
    'guardar.guardadoEn': 'Guardado en {ruta}.',
    'guardar.enviadoImpresora': 'Enviado a la impresora.',
  },
  en: {
    'guardar.sinClave': 'This file will be saved WITHOUT a password. To protect it, use Tools → Add a password.',
    'guardar.sufijo': '-signed',
    'guardar.versionFinalFallo': 'The final version of this form could not be created.',
    'guardar.protegidoGuardar': 'This PDF is protected, so it cannot be saved with changes.',
    'guardar.noPreparado': 'The file could not be prepared. ',
    'guardar.protegido': 'This PDF is protected, so it cannot be saved with changes.',
    'guardar.preparandoFinal': 'Preparing the final version…',
    'guardar.guardando': 'Saving…',
    'guardar.guardadoSimbolos': 'Saved. {msg}',
    'guardar.guardadoDescargas': 'Saved in your Downloads folder.',
    'guardar.preparandoImpresion': 'Getting ready to print…',
    'guardar.ventanaBloqueada': 'The browser blocked the print window.',
    'guardar.guardadoEn': 'Saved in {ruta}.',
    'guardar.enviadoImpresora': 'Sent to the printer.',
  },
});
const msgSinClave = () => t('guardar.sinClave');
const quitarExt = (n) => n.replace(/\.pdf$/i, '').replace(/-(firmado|signed)$/i, '');
export const nombreSalida = () => quitarExt(E.nombreActual) + t('guardar.sufijo') + '.pdf';

export async function obtenerPagina(n) { return E.paginas[n] || (E.paginas[n] = await E.pdf.getPage(n)); }
export async function construirPdf(final, base) {
  const bytes = base || await E.pdf.saveDocument(); // `base`: bytes ya guardados (evita guardar dos veces); incluye lo escrito en los campos del formulario
  const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
  const fuente = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const lista = doc.getPages(), imagenes = new Map();
  E.avisoSimbolos = false;
  const seguro = (s) => { let r = ''; for (const ch of s) { try { fuente.encodeText(ch); r += ch; } catch (_) { r += '?'; E.avisoSimbolos = true; } } return r; };
  for (const it of E.items) {
    if (it.tipo === 'ocultar') continue; // nunca se dibuja aquí (sería un recuadro negro sobre texto vivo): solo aplicarOcultar lo convierte en imagen
    const pg = lista[it.pagina - 1]; if (!pg) continue;
    const pp = await obtenerPagina(it.pagina);
    const V = pp.getViewport({ scale: 1 });
    // Giro del elemento (it.rot, grados hacia la derecha tal como se ve; solo firma, imagen y texto) más el de la página (/Rotate).
    // pdf-lib gira hacia la izquierda alrededor de la esquina inferior izquierda: se calcula dónde cae ese punto con el giro hecho
    // alrededor del centro, y el ángulo es (giro de página - giro del elemento).
    const rot = (it.tipo === 'firma' || it.tipo === 'imagen' || it.tipo === 'texto') ? (it.rot || 0) : 0;
    const giro = PDFLib.degrees((((Math.round(pp.rotate) - rot) % 360) + 360) % 360);
    const rc = Math.cos(rot * Math.PI / 180), rs = Math.sin(rot * Math.PI / 180);
    const girado = (w, h, lx, ly) => { const dx = lx - w / 2, dy = ly - h / 2; return [it.x + w / 2 + dx * rc - dy * rs, it.y + h / 2 + dx * rs + dy * rc]; }; // punto (lx,ly) de la caja, ya girado
    if (it.tipo === 'firma' || it.tipo === 'imagen') {
      const fuenteImg = it.png || it.src;
      let img = imagenes.get(fuenteImg);
      if (!img) {
        const bin = deBase64(fuenteImg.split(',')[1]);
        img = bin[0] === 0xFF && bin[1] === 0xD8 ? await doc.embedJpg(bin) : await doc.embedPng(bin); // fotos del celular: JPEG; firmas: PNG
        imagenes.set(fuenteImg, img);
      }
      const [x, y] = V.convertToPdfPoint(...girado(it.w, it.h, 0, it.h));
      pg.drawImage(img, { x, y, width: it.w, height: it.h, rotate: giro });
    } else if (it.tipo !== 'texto') {
      dibujarAnotacion(doc, pg, V, it); // resaltar, subrayar, tachar, trazo, rectángulo, flecha, nota
    } else {
      const lineas = it.texto.split('\n');
      // caja del texto como se ve en pantalla (línea de 1 × tamaño de alto): su centro es el del giro
      const ancho = Math.max(1.5 * it.size, ...lineas.map((l) => fuente.widthOfTextAtSize(seguro(l), it.size))), alto = lineas.length * it.size;
      for (let i = 0; i < lineas.length; i++) {
        if (!lineas[i].trim()) continue;
        const [x, y] = V.convertToPdfPoint(...girado(ancho, alto, 0, it.size * (0.85 + i)));
        pg.drawText(seguro(lineas[i]), { x, y, size: it.size, font: fuente, color: PDFLib.rgb(0, 0, 0), rotate: giro });
      }
    }
  }
  if (final) {
    try { doc.getForm().flatten(); } catch (e) { console.error(e); throw new Error(t('guardar.versionFinalFallo')); }
  }
  recolectarBasura(doc);
  return await doc.save();
}
export function mensajeError(e) {
  const m = String((e && e.message) || e);
  if (/encrypt/i.test(m)) return t('guardar.protegidoGuardar');
  return t('guardar.noPreparado') + (m.length < 120 ? m : '');
}
async function guardar(final) {
  cerrarModal('dlgGuardar');
  if (!E.pdf || ocupado()) return;
  if (E.protegido) { toast(t('guardar.protegido'), true, 5000); return; }
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  if (!(await asegurarOcultos())) return;
  const sinClave = E.avisoSinClave; E.avisoSinClave = false; // se avisa una sola vez tras quitar la contraseña
  mostrarCarga(final ? t('guardar.preparandoFinal') : t('guardar.guardando'));
  let bytes;
  try { bytes = await construirPdf(final); } catch (e) { ocultarCarga(); E.avisoSinClave = E.avisoSinClave || sinClave; console.error(e); toast(mensajeError(e), true, 6000); return; }
  if (!puente) {
    descargar(bytes, nombreSalida()); ocultarCarga();
    toast((E.avisoSimbolos ? t('guardar.guardadoSimbolos', { msg: msgSimbolos() }) : t('guardar.guardadoDescargas')) + (sinClave ? ' ' + msgSinClave() : ''), E.avisoSimbolos, sinClave ? 9000 : 6000);
    await recargarGuardado(bytes, nombreSalida()); return;
  }
  E.esperando = { bytes, sinClave };
  post({ tipo: 'guardar', datos: aBase64(bytes), nombre: nombreSalida() });
}
async function recargarGuardado(bytes, nombre) {
  // lo colocado ya quedó impreso en el PDF: se recarga para que no se duplique
  await cargarPDF(bytes, nombre, { pagina: E.pdf ? pdfViewer.currentPageNumber : 1 });
}
export async function imprimir() {
  if (!E.pdf || ocupado()) return;
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  if (!(await asegurarOcultos())) return;
  mostrarCarga(t('guardar.preparandoImpresion'));
  let bytes;
  try { bytes = await construirPdf(true); } catch (e) { ocultarCarga(); console.error(e); toast(mensajeError(e), true, 6000); return; }
  if (!puente) {
    ocultarCarga();
    const w = window.open(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), '_blank');
    if (!w) toast(t('guardar.ventanaBloqueada'), true); return;
  }
  if (E.avisoSimbolos) toast(msgSimbolos(), true, 6000);
  E.esperando = { imprimir: true };
  post({ tipo: 'imprimir', datos: aBase64(bytes) });
  setTimeout(() => { if (E.esperando && E.esperando.imprimir) { E.esperando = null; ocultarCarga(); } }, 120000);
}
$('bGuardar').onclick = () => { if (ocupado()) return; if (E.pdf && !E.protegido) abrirModal('dlgGuardar'); else if (E.protegido) toast(t('guardar.protegido'), true, 5000); };
$('gEditable').onclick = () => guardar(false);
$('gFinal').onclick = () => guardar(true);
$('bImprimir').onclick = imprimir;

alMensaje('guardado', async (m) => {
  ocultarCarga();
  const e = E.esperando; E.esperando = null;
  const extra = e && e.sinClave ? ' ' + msgSinClave() : '';
  if (E.avisoSimbolos) { toast(t('guardar.guardadoSimbolos', { msg: msgSimbolos() }) + extra, true, 9000); E.avisoSimbolos = false; }
  else toast(t('guardar.guardadoEn', { ruta: m.ruta }) + extra, false, extra ? 9000 : 6000);
  if (e && e.bytes) await recargarGuardado(e.bytes, String(m.ruta).split(/[\\/]/).pop());
});
alMensaje('cancelado', () => { if (E.esperando && E.esperando.sinClave) E.avisoSinClave = true; E.esperando = null; ocultarCarga(); });
alMensaje('impreso', () => { E.esperando = null; ocultarCarga(); toast(t('guardar.enviadoImpresora')); });
alMensaje('error', (m) => {
  if (m.id !== undefined && m.id !== null) return; // errores de un pedido (con id): los resuelve pedir(); no deben cerrar la carga de otra operación
  E.esperando = null; ocultarCarga(); toast(m.mensaje || t('puente.error'), true, 7000);
});
