// Fase 3 "Proteger": comprimir, poner y quitar contraseña, ocultar información (redactar de verdad).
// El trabajo pesado de comprimir (ligera/media), cifrar y descifrar lo hace el programa de Windows (C#, ver CONTRATO.md);
// la compresión fuerte y el ocultado se hacen aquí: la página se dibuja como imagen y se reemplaza en el PDF.
import { E, on } from './estado.js';
import { agregar, t, tn, idioma } from './i18n.js';
import { $, toast, elegir, confirmar, pedirTexto, progreso, finProgreso, ocupado, aBase64, deBase64 } from './util.js';
import { pedir, puente } from './puente.js';
import { cambiarDocumento, reemplazarDocumento, bytesActuales, cargarPDF, recolectarBasura } from './documento.js';
import { pdfjsLib, OPC_PDF, vistaPagina, renderAviso, pdfViewer } from './visor.js';
import { commit } from './historial.js';
import { tipos, sincronizar, capaDe, cancelarColocar } from './elementos.js';
import { elegirHerramienta, abrirAnotar } from './anotar.js';
import { registrarHerramienta } from './herramientas.js';
import { quitarCamposDe, redirigirDestinos } from './paginas.js';
import { mensajeError, obtenerPagina } from './guardar.js';
import { dibujarAnotacion } from './dibujo.js';
import { asegurarOcultos } from './ocultos.js';

// ---------- textos (es / en) ----------
agregar({
  es: {
    'proteger.nombreDoc': 'documento.pdf',
    'proteger.sufijo': '-protegido',
    'proteger.abrirPrimero': 'Abra un PDF primero.',
    'proteger.soloPrograma': 'Esta función solo está en el programa de Windows.',
    'proteger.sinClave': 'Este PDF tiene contraseña. Primero quítela con "Quitar contraseña".',
    'proteger.progresoPag': '{texto} (página {i} de {n})…',
    'proteger.preparando': 'Preparando…',
    // comprimir
    'proteger.comprimir': 'Comprimir PDF',
    'proteger.comprimirDesc': 'Haga más liviano el archivo para enviarlo',
    'proteger.comprimiendo': 'Comprimiendo',
    'proteger.comprimiendoPdf': 'Comprimiendo el PDF',
    'proteger.comprimiendoPdfPuntos': 'Comprimiendo el PDF…',
    'proteger.noComprimio': 'No se pudo comprimir.',
    'proteger.noComprimioPdf': 'No se pudo comprimir este PDF.',
    'proteger.cuanto': '¿Cuánto quiere comprimir?',
    'proteger.nivelLigera': 'Ligera (se ve igual)',
    'proteger.nivelLigeraDesc': 'Baja un poco el peso, sin cambios visibles',
    'proteger.nivelMedia': 'Media (recomendada)',
    'proteger.nivelMediaDesc': 'Baja bastante el peso, se ve casi igual',
    'proteger.nivelFuerte': 'Fuerte (convierte las páginas en imagen)',
    'proteger.nivelFuerteDesc': 'El texto ya no se podrá seleccionar ni buscar',
    'proteger.avFirma': 'La firma digital dejará de ser válida.',
    'proteger.avFormFijos': 'Los campos del formulario quedarán fijos.',
    'proteger.avMarcadores': 'Se perderán los marcadores.',
    'proteger.antesTitulo': 'Antes de comprimir',
    'proteger.quiereContinuar': '¿Quiere continuar?',
    'proteger.siComprimir': 'Sí, comprimir',
    'proteger.noCancelar': 'No, cancelar',
    'proteger.fuerteTitulo': 'Compresión fuerte',
    'proteger.fuerteMsg': 'Las páginas se convertirán en imagen. El texto ya no se podrá seleccionar. Los campos de formulario quedarán fijos.',
    'proteger.cancelado': 'Cancelado. El documento no cambió.',
    'proteger.yaComprimido': 'Este PDF ya estaba comprimido.',
    'proteger.listo': 'Listo',
    'proteger.antesAhora': 'Antes {antes} → ahora {despues} ({pct} % menos)\n\n¿Usar el archivo comprimido?',
    'proteger.siUsarlo': 'Sí, usarlo',
    'proteger.noOriginal': 'No, dejar el original',
    'proteger.listoGuarde': 'Listo. Para conservarlo, guarde el documento.',
    // poner contraseña
    'proteger.poner': 'Poner contraseña',
    'proteger.ponerDesc': 'Proteja el archivo para que solo lo abra quien la sepa',
    'proteger.poniendo': 'Poniendo la contraseña…',
    'proteger.noPoner': 'No se pudo poner la contraseña.',
    'proteger.min4': 'La contraseña debe tener al menos 4 caracteres que no sean solo espacios.',
    'proteger.yaTiene': 'Este PDF ya tiene contraseña.',
    'proteger.anoteTitulo': 'Anote su contraseña',
    'proteger.anoteMsg': 'Si olvida la contraseña no se podrá abrir el archivo. Anótela.\n\nSe guardará una copia protegida; este documento seguirá igual y podrá seguir editándolo.',
    'proteger.entendidoContinuar': 'Entendido, continuar',
    'proteger.cancelar': 'Cancelar',
    'proteger.escriba': 'Escriba la contraseña (mínimo 4 caracteres)',
    'proteger.siguiente': 'Siguiente',
    'proteger.repitaTitulo': 'Repita la contraseña',
    'proteger.escribaOtra': 'Escríbala otra vez',
    'proteger.proteger': 'Proteger',
    'proteger.noIguales': 'Las contraseñas no son iguales. Inténtelo de nuevo.',
    'proteger.guardadoClave': 'Guardado con contraseña. No la olvide.',
    'proteger.noGuardado': 'No se guardó el archivo protegido.',
    // quitar contraseña
    'proteger.quitar': 'Quitar contraseña',
    'proteger.quitarDesc': 'Deje el archivo abierto para editarlo y guardarlo',
    'proteger.quitando': 'Quitando la contraseña…',
    'proteger.noQuitar': 'No se pudo quitar la contraseña.',
    'proteger.perdFirma': 'La firma digital dejará de ser válida.',
    'proteger.perdCampos': 'Se perderán los campos del formulario.',
    'proteger.perdMarcadores': 'Se perderán los marcadores.',
    'proteger.sinClaveDoc': 'Este PDF no tiene contraseña.',
    'proteger.reabrir': 'Vuelva a abrir el PDF e ingrese la contraseña.',
    'proteger.quitarOfrecido': 'Para editar y guardar este PDF hay que quitarle la contraseña. ¿Quitarla?\n(Puede volver a ponerla al guardar con "Poner contraseña")',
    'proteger.quitarNormal': 'Se quitará la contraseña de este PDF para poder editarlo y guardarlo. ¿Continuar?\n(Puede volver a ponerla con "Poner contraseña")',
    'proteger.atencion': 'Atención:',
    'proteger.quitarTitulo': 'Quitar la contraseña',
    'proteger.siQuitarla': 'Sí, quitarla',
    'proteger.soloLeerlo': 'No, solo leerlo',
    'proteger.claveQuitada': 'Contraseña quitada. Ya puede editar y guardar.',
    // ocultar información
    'proteger.ocultar': 'Ocultar información',
    'proteger.ocultarDesc': 'Tape para siempre datos que no deben verse',
    'proteger.recuadros.1': '{n} recuadro marcado',
    'proteger.recuadros.n': '{n} recuadros marcados',
    'proteger.nadaMarcado': 'Aún no marcó nada',
    'proteger.aviso': 'Arrastre sobre lo que quiere ocultar. Se pintará un recuadro negro.',
    'proteger.marqueAntes': 'Marque primero lo que quiere ocultar.',
    'proteger.laPagina.1': 'la página {pags}',
    'proteger.laPagina.n': 'las páginas {pags}',
    'proteger.extraFirma': 'La firma digital dejará de ser válida.',
    'proteger.extraForm': 'Los campos del formulario de esas páginas se perderán.',
    'proteger.casillaMeta': 'Borrar también el título, asunto, palabras clave y marcadores del documento',
    'proteger.paraSiempre': 'Ocultar para siempre',
    'proteger.ocultarMsg': 'Las páginas marcadas ({txt}) se convertirán en imagen.\nEl texto tapado desaparecerá del archivo y no se podrá recuperar.{extra}\n\nLas demás páginas no cambian.',
    'proteger.siOcultar': 'Sí, ocultar para siempre',
    'proteger.noVolver': 'No, volver',
    'proteger.ocultando': 'Ocultando información',
    'proteger.armando': 'Armando el documento…',
    'proteger.ocultoListo': 'Listo. La información quedó oculta para siempre.',
  },
  en: {
    'proteger.nombreDoc': 'document.pdf',
    'proteger.sufijo': '-protected',
    'proteger.abrirPrimero': 'Please open a PDF first.',
    'proteger.soloPrograma': 'This feature is only available in the Windows app.',
    'proteger.sinClave': 'This PDF has a password. Please remove it first with "Remove password".',
    'proteger.progresoPag': '{texto} (page {i} of {n})…',
    'proteger.preparando': 'Getting ready…',
    'proteger.comprimir': 'Compress PDF',
    'proteger.comprimirDesc': 'Make the file smaller so it is easier to send',
    'proteger.comprimiendo': 'Compressing',
    'proteger.comprimiendoPdf': 'Compressing the PDF',
    'proteger.comprimiendoPdfPuntos': 'Compressing the PDF…',
    'proteger.noComprimio': 'The PDF could not be compressed.',
    'proteger.noComprimioPdf': 'This PDF could not be compressed.',
    'proteger.cuanto': 'How much do you want to compress?',
    'proteger.nivelLigera': 'Light (looks the same)',
    'proteger.nivelLigeraDesc': 'Makes the file a little smaller, with no visible changes',
    'proteger.nivelMedia': 'Medium (recommended)',
    'proteger.nivelMediaDesc': 'Makes the file much smaller, and it looks almost the same',
    'proteger.nivelFuerte': 'Strong (turns the pages into images)',
    'proteger.nivelFuerteDesc': 'The text can no longer be selected or searched',
    'proteger.avFirma': 'The digital signature will no longer be valid.',
    'proteger.avFormFijos': 'The form fields will become fixed.',
    'proteger.avMarcadores': 'The bookmarks will be lost.',
    'proteger.antesTitulo': 'Before compressing',
    'proteger.quiereContinuar': 'Do you want to continue?',
    'proteger.siComprimir': 'Yes, compress',
    'proteger.noCancelar': 'No, cancel',
    'proteger.fuerteTitulo': 'Strong compression',
    'proteger.fuerteMsg': 'The pages will be turned into images. The text can no longer be selected. The form fields will become fixed.',
    'proteger.cancelado': 'Cancelled. The document did not change.',
    'proteger.yaComprimido': 'This PDF was already compressed.',
    'proteger.listo': 'Done',
    'proteger.antesAhora': 'Before {antes} → now {despues} ({pct}% smaller)\n\nUse the compressed file?',
    'proteger.siUsarlo': 'Yes, use it',
    'proteger.noOriginal': 'No, keep the original',
    'proteger.listoGuarde': 'Done. To keep it, save the document.',
    'proteger.poner': 'Add password',
    'proteger.ponerDesc': 'Protect the file so only people who know the password can open it',
    'proteger.poniendo': 'Adding the password…',
    'proteger.noPoner': 'The password could not be added.',
    'proteger.min4': 'The password must have at least 4 characters that are not just spaces.',
    'proteger.yaTiene': 'This PDF already has a password.',
    'proteger.anoteTitulo': 'Write down your password',
    'proteger.anoteMsg': 'If you forget the password, the file cannot be opened. Please write it down.\n\nA protected copy will be saved. This document stays as it is, and you can keep editing it.',
    'proteger.entendidoContinuar': 'Got it, continue',
    'proteger.cancelar': 'Cancel',
    'proteger.escriba': 'Type the password (at least 4 characters)',
    'proteger.siguiente': 'Next',
    'proteger.repitaTitulo': 'Type the password again',
    'proteger.escribaOtra': 'Type it once more',
    'proteger.proteger': 'Protect',
    'proteger.noIguales': 'The passwords do not match. Please try again.',
    'proteger.guardadoClave': 'Saved with a password. Please do not forget it.',
    'proteger.noGuardado': 'The protected file was not saved.',
    'proteger.quitar': 'Remove password',
    'proteger.quitarDesc': 'Leave the file unlocked so you can edit and save it',
    'proteger.quitando': 'Removing the password…',
    'proteger.noQuitar': 'The password could not be removed.',
    'proteger.perdFirma': 'The digital signature will no longer be valid.',
    'proteger.perdCampos': 'The form fields will be lost.',
    'proteger.perdMarcadores': 'The bookmarks will be lost.',
    'proteger.sinClaveDoc': 'This PDF does not have a password.',
    'proteger.reabrir': 'Please open the PDF again and type its password.',
    'proteger.quitarOfrecido': 'To edit and save this PDF, its password has to be removed. Remove it?\n(You can add it again when saving, with "Add password")',
    'proteger.quitarNormal': 'The password of this PDF will be removed so you can edit and save it. Continue?\n(You can add it again with "Add password")',
    'proteger.atencion': 'Please note:',
    'proteger.quitarTitulo': 'Remove the password',
    'proteger.siQuitarla': 'Yes, remove it',
    'proteger.soloLeerlo': 'No, just read it',
    'proteger.claveQuitada': 'Password removed. You can now edit and save.',
    'proteger.ocultar': 'Hide information',
    'proteger.ocultarDesc': 'Cover up details that should not be seen, for good',
    'proteger.recuadros.1': '{n} box marked',
    'proteger.recuadros.n': '{n} boxes marked',
    'proteger.nadaMarcado': 'You have not marked anything yet',
    'proteger.aviso': 'Drag over what you want to hide. A black box will be drawn over it.',
    'proteger.marqueAntes': 'First mark what you want to hide.',
    'proteger.laPagina.1': 'page {pags}',
    'proteger.laPagina.n': 'pages {pags}',
    'proteger.extraFirma': 'The digital signature will no longer be valid.',
    'proteger.extraForm': 'The form fields on those pages will be lost.',
    'proteger.casillaMeta': 'Also erase the title, subject, keywords and bookmarks of the document',
    'proteger.paraSiempre': 'Hide for good',
    'proteger.ocultarMsg': 'The marked pages ({txt}) will be turned into images.\nThe covered text will disappear from the file and cannot be recovered.{extra}\n\nThe other pages do not change.',
    'proteger.siOcultar': 'Yes, hide for good',
    'proteger.noVolver': 'No, go back',
    'proteger.ocultando': 'Hiding information',
    'proteger.armando': 'Putting the document together…',
    'proteger.ocultoListo': 'Done. The information is now hidden for good.',
  },
});

// ---------- utilidades ----------
const baseNombre = () => (E.nombreActual || t('proteger.nombreDoc')).replace(/\.pdf$/i, '').replace(/-(firmado|protegido|comprimido|signed|protected|compressed)$/i, '');
export function fmtTam(n) {
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
  const mb = (n / 1024 / 1024).toFixed(1);
  return (idioma() === 'en' ? mb : mb.replace('.', ',')) + ' MB';
}
const aBlob = (canvas, tipo, calidad) => new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('imagen'))), tipo, calidad));
const cancelacion = () => Object.assign(new Error('Cancelado'), { cancelado: true });

function listo() {
  if (!E.pdf) { toast(t('proteger.abrirPrimero'), true); return false; }
  if (ocupado()) return false;
  return true;
}
function necesitaPrograma() {
  if (puente) return true;
  toast(t('proteger.soloPrograma'), true, 5000);
  return false;
}
function sinContrasena() {
  if (!E.protegido) return true;
  toast(t('proteger.sinClave'), true, 6000);
  return false;
}
// pide al programa y devuelve la respuesta o null (el error ya se mostró). Mantiene la pantalla de espera.
async function motor(tipo, datos, texto) {
  progreso(texto);
  try { return await pedir(tipo, datos, { tiempo: 5 * 60 * 1000 }); } finally { finProgreso(); }
}
export async function analizar(bytes) {
  if (!puente) return null;
  const r = await pedir('analizarPdf', { datos: aBase64(bytes) }, { tiempo: 60000 });
  return r && r.info ? r.info : null;
}

// ---------- dibujar páginas como imagen (pdf.js) ----------
// → [{n, w, h (puntos, con el giro aplicado), jpg: Uint8Array}]
async function paginasAImagen(bytes, paginas, dpi, calidad, texto) {
  const tarea = pdfjsLib.getDocument({ data: bytes.slice(), ...OPC_PDF });
  let doc;
  try { doc = await tarea.promise; } catch (e) { try { tarea.destroy(); } catch (_) { /* nada */ } throw e; }
  let cancelar = false;
  const res = [];
  try {
    for (let i = 0; i < paginas.length; i++) {
      if (cancelar) throw cancelacion();
      progreso(t('proteger.progresoPag', { texto, i: i + 1, n: paginas.length }), i / paginas.length, () => { cancelar = true; });
      const pag = await doc.getPage(paginas[i]);
      const v1 = pag.getViewport({ scale: 1 });
      let esc = dpi / 72; const mayor = Math.max(v1.width, v1.height) * esc;
      if (mayor > 6000) esc = esc * 6000 / mayor;
      const vp = pag.getViewport({ scale: esc });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      try {
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await pag.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
        const b = await aBlob(c, 'image/jpeg', calidad);
        res.push({ n: paginas[i], w: v1.width, h: v1.height, jpg: new Uint8Array(await b.arrayBuffer()) });
      } finally { c.width = c.height = 0; pag.cleanup(); }
    }
  } finally { try { await tarea.destroy(); } catch (_) { /* nada */ } }
  return res;
}

// ================= Comprimir =================
async function comprimirFuerte(bytes) {
  const n = E.pdf.numPages;
  const imgs = await paginasAImagen(bytes, Array.from({ length: n }, (_, i) => i + 1), 110, 0.6, t('proteger.comprimiendo'));
  const doc = await PDFLib.PDFDocument.create();
  for (const p of imgs) {
    const img = await doc.embedJpg(p.jpg);
    const pg = doc.addPage([p.w, p.h]);
    pg.drawImage(img, { x: 0, y: 0, width: p.w, height: p.h });
  }
  return await doc.save();
}
// → {datos: Uint8Array, antes, despues}. Si no bajó de tamaño devuelve los mismos bytes.
export async function comprimirBytes(bytes, nivel) {
  if (nivel === 'fuerte') {
    let datos;
    try { datos = await comprimirFuerte(bytes); } finally { finProgreso(); }
    return datos.length < bytes.length ? { datos, antes: bytes.length, despues: datos.length } : { datos: bytes, antes: bytes.length, despues: bytes.length };
  }
  if (!puente) throw new Error(t('proteger.soloPrograma'));
  const r = await motor('comprimirPdf', { datos: aBase64(bytes), nivel }, t('proteger.comprimiendoPdfPuntos'));
  if (!r) throw Object.assign(new Error(t('proteger.noComprimio')), { avisado: true });
  return { datos: deBase64(r.datos), antes: r.antes, despues: r.despues };
}

async function comprimir() {
  if (!listo() || !sinContrasena()) return;
  const nivel = await elegir(t('proteger.cuanto'), [
    { valor: 'ligera', texto: t('proteger.nivelLigera'), descripcion: t('proteger.nivelLigeraDesc') },
    { valor: 'media', texto: t('proteger.nivelMedia'), descripcion: t('proteger.nivelMediaDesc') },
    { valor: 'fuerte', texto: t('proteger.nivelFuerte'), descripcion: t('proteger.nivelFuerteDesc') },
  ]);
  if (!nivel) return;
  if (nivel !== 'fuerte' && !necesitaPrograma()) return;
  let bytes; // bytesActuales() pide aplicar las zonas "ocultar" pendientes (ocultos.js)
  try { progreso(t('proteger.preparando')); bytes = await bytesActuales(); } catch (e) { finProgreso(); if (e.cancelado) return; console.error(e); toast(mensajeError(e), true, 6000); return; }
  finProgreso();
  // advertencias con datos reales del archivo
  const info = await analizar(bytes);
  if (info) {
    const av = [];
    if (info.firmaDigital) av.push(t('proteger.avFirma'));
    if (nivel === 'fuerte') {
      if (info.formularios) av.push(t('proteger.avFormFijos'));
      if (info.marcadores) av.push(t('proteger.avMarcadores'));
    }
    if (av.length && !(await confirmar(t('proteger.antesTitulo'), av.join('\n') + '\n\n' + t('proteger.quiereContinuar'), t('proteger.siComprimir'), t('proteger.noCancelar')))) return;
  } else if (nivel === 'fuerte' && !(await confirmar(t('proteger.fuerteTitulo'), t('proteger.fuerteMsg') + '\n\n' + t('proteger.quiereContinuar'), t('proteger.siComprimir'), t('proteger.noCancelar')))) return;
  let r;
  try { r = await comprimirBytes(bytes, nivel); }
  catch (e) { finProgreso(); if (e.cancelado) toast(t('proteger.cancelado')); else if (!e.avisado) { console.error(e); toast(t('proteger.noComprimioPdf'), true, 6000); } return; }
  finProgreso();
  if (r.despues >= r.antes) { toast(t('proteger.yaComprimido'), false, 6000); return; }
  const pct = Math.max(1, Math.round((1 - r.despues / r.antes) * 100));
  const usar = await confirmar(t('proteger.listo'), t('proteger.antesAhora', { antes: fmtTam(r.antes), despues: fmtTam(r.despues), pct }), t('proteger.siUsarlo'), t('proteger.noOriginal'));
  if (!usar) return;
  if (await reemplazarDocumento(r.datos, t('proteger.comprimiendoPdf'))) toast(t('proteger.listoGuarde'), false, 6000);
}

// ================= Poner contraseña =================
export async function protegerBytes(contrasena, bytes) {
  const r = await motor('protegerPdf', { datos: aBase64(bytes || await bytesActuales()), contrasena }, t('proteger.poniendo'));
  if (!r) throw Object.assign(new Error(t('proteger.noPoner')), { avisado: true });
  return deBase64(r.datos);
}
// Al menos 4 caracteres que no sean solo espacios. (Probado: pdf.js abre contraseñas con ñ y tildes, no hace falta restringirlas.)
function validarContrasena(v) {
  return v.trim().length < 4 ? t('proteger.min4') : null;
}
async function ponerContrasena() {
  if (!listo()) return;
  if (E.protegido) { toast(t('proteger.yaTiene'), true, 5000); return; }
  if (!necesitaPrograma()) return;
  if (!(await asegurarOcultos())) return; // se pregunta antes de pedir la contraseña (bytesActuales lo exigiría de todos modos)
  const ok = await confirmar(t('proteger.anoteTitulo'), t('proteger.anoteMsg'), t('proteger.entendidoContinuar'), t('proteger.cancelar'));
  if (!ok) return;
  const c1 = await pedirTexto(t('proteger.poner'), t('proteger.escriba'), '', {
    tipo: 'password', ok: t('proteger.siguiente'), validar: validarContrasena,
  });
  if (c1 === null) return;
  const c2 = await pedirTexto(t('proteger.repitaTitulo'), t('proteger.escribaOtra'), '', {
    tipo: 'password', ok: t('proteger.proteger'), validar: (v) => (v !== c1 ? t('proteger.noIguales') : null),
  });
  if (c2 === null) return;
  let datos;
  try { progreso(t('proteger.preparando')); const bytes = await bytesActuales(); finProgreso(); datos = await protegerBytes(c1, bytes); }
  catch (e) { finProgreso(); if (!e.avisado && !e.cancelado) { console.error(e); toast(mensajeError(e), true, 6000); } return; }
  const g = await pedir('guardarArchivo', { datos: aBase64(datos), nombre: baseNombre() + t('proteger.sufijo') + '.pdf', tipo: 'pdf' });
  if (g) toast(t('proteger.guardadoClave'), false, 7000);
  else toast(t('proteger.noGuardado'), false, 5000);
}

// ================= Quitar contraseña =================
export async function quitarContrasenaBytes(bytes, contrasena) {
  const r = await motor('quitarContrasena', { datos: aBase64(bytes), contrasena }, t('proteger.quitando'));
  if (!r) throw Object.assign(new Error(t('proteger.noQuitar')), { avisado: true });
  return deBase64(r.datos);
}
// Lo que se perdería al pasar por el motor (se mide con pdf.js, que sí puede leer el PDF ya abierto)
async function perdidasAlQuitar() {
  const av = [];
  try {
    const campos = await E.pdf.getFieldObjects();
    const lista = campos ? Object.values(campos).flat() : [];
    if (lista.some((c) => c.type === 'signature')) av.push(t('proteger.perdFirma'));
    if (lista.length) av.push(t('proteger.perdCampos'));
  } catch (_) { /* nada */ }
  try { const o = await E.pdf.getOutline(); if (o && o.length) av.push(t('proteger.perdMarcadores')); } catch (_) { /* nada */ }
  return av;
}
let ofreciendo = false;
async function quitarContrasena(ofrecido) {
  if (!E.pdf) { toast(t('proteger.abrirPrimero'), true); return; }
  if (!E.protegido) { toast(t('proteger.sinClaveDoc')); return; }
  if (!E.claveDoc || !E.bytesClave) { toast(t('proteger.reabrir'), true, 6000); return; }
  if (ofreciendo || (!ofrecido && ocupado())) return;
  if (!necesitaPrograma()) return;
  ofreciendo = true;
  try {
    const av = await perdidasAlQuitar();
    const msg = (ofrecido
      ? t('proteger.quitarOfrecido')
      : t('proteger.quitarNormal'))
      + (av.length ? '\n\n' + t('proteger.atencion') + '\n' + av.join('\n') : '');
    if (!(await confirmar(t('proteger.quitarTitulo'), msg, t('proteger.siQuitarla'), ofrecido ? t('proteger.soloLeerlo') : t('proteger.cancelar')))) return;
    let bytes;
    try { bytes = await quitarContrasenaBytes(E.bytesClave, E.claveDoc); }
    catch (e) { if (!e.avisado) { console.error(e); toast(t('proteger.noQuitar'), true, 6000); } return; }
    const claveAntes = E.claveDoc, bytesAntes = E.bytesClave;
    E.claveDoc = E.bytesClave = null; // la contraseña no se queda en memoria una vez quitada
    const ok = await cargarPDF(bytes, E.nombreActual, { conservar: true, items: E.items, docId: E.docId, pagina: pdfViewer.currentPageNumber });
    if (ok) { E.avisoSinClave = true; toast(t('proteger.claveQuitada'), false, 6000); }
    else { E.claveDoc = claveAntes; E.bytesClave = bytesAntes; } // cargarPDF dejó el documento anterior (aún con contraseña)
  } finally { ofreciendo = false; }
}
// al abrir un PDF con contraseña (y escribirla bien) se ofrece quitarla
on('documentoCargado', ({ protegido, conservar }) => {
  if (protegido && !conservar) setTimeout(() => { quitarContrasena(true); }, 50);
});

// ================= Ocultar información =================
const NS_BARRA = $('barraOcultar');
let activo = false, tBarra = 0;

tipos.ocultar = {
  crear(it, el) { const n = document.createElement('div'); n.className = 'neg'; el.appendChild(n); },
  estilar() {},
};
const hayRecuadros = () => E.items.filter((i) => i.tipo === 'ocultar');
function pintarBarra() {
  const n = hayRecuadros().length;
  $('ocultarInfo').textContent = n ? tn('proteger.recuadros', n) : t('proteger.nadaMarcado');
  $('bOcultarAplicar').disabled = !n;
}
on('sincronizar', () => { if (activo) pintarBarra(); });
// cambio de idioma con la barra abierta: se vuelve a pintar el contador y el aviso del visor
on('idioma', () => {
  if (!activo) return;
  pintarBarra();
  if (E.avisoHerr === avisoPuesto) { avisoPuesto = aviso(); E.avisoHerr = avisoPuesto; renderAviso(); }
});

export function terminarOcultar() {
  if (!activo) return;
  activo = false; clearInterval(tBarra); document.body.classList.remove('ocultando'); NS_BARRA.classList.add('hidden');
  if (avisoPuesto && E.avisoHerr === avisoPuesto) { E.avisoHerr = ''; renderAviso(); }
  avisoPuesto = '';
}
const aviso = () => t('proteger.aviso');
let avisoPuesto = '';   // el texto que quedó en el visor (cambia con el idioma)
function empezarOcultar() {
  if (!listo() || !sinContrasena()) return;
  elegirHerramienta(null); abrirAnotar(false); cancelarColocar();
  activo = true; document.body.classList.add('ocultando'); NS_BARRA.classList.remove('hidden');
  avisoPuesto = aviso(); E.avisoHerr = avisoPuesto; renderAviso(); pintarBarra();
  clearInterval(tBarra); tBarra = setInterval(pintarBarra, 400); // el contador sigue a los recuadros (crear, borrar, deshacer)
}
on('cerrarAnotar', terminarOcultar);
on('documentoCargado', ({ conservar }) => { if (!conservar) terminarOcultar(); else if (activo) pintarBarra(); });
$('bOcultarCerrar').onclick = terminarOcultar;
$('bOcultarAplicar').onclick = () => { aplicarOcultar(true).catch((e) => console.error(e)); };
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !activo || E.colocando || document.querySelector('.modal:not(.hidden)')) return;
  terminarOcultar();
}, true);

// arrastrar para dibujar el recuadro
const acotar = (v, a, b) => Math.min(b, Math.max(a, v));
function puntoEn(pag, cx, cy) {
  const n = +pag.dataset.pageNumber, pv = vistaPagina(n); if (!pv) return null;
  const r = pag.getBoundingClientRect(), k = pv.viewport.scale, f = r.width / pag.offsetWidth;
  return { n, pv, x: (cx - r.left) / f / k, y: (cy - r.top) / f / k, W: pv.viewport.width / k, H: pv.viewport.height / k };
}
let arr = null;
document.addEventListener('pointerdown', (e) => {
  if (!activo || (e.button !== undefined && e.button !== 0)) return;
  const t = e.target; if (!t.closest) return;
  const pag = t.closest('#pdfViewer .page'); if (!pag || t.closest('.it') || t.closest('.ctl')) return;
  const p = puntoEn(pag, e.clientX, e.clientY); if (!p) return;
  e.preventDefault();
  try { pag.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
  const v = document.createElement('div'); v.className = 'vista-ocultar'; capaDe(p.pv).appendChild(v);
  arr = { pag, n: p.n, pv: p.pv, W: p.W, H: p.H, x0: acotar(p.x, 0, p.W), y0: acotar(p.y, 0, p.H), x1: p.x, y1: p.y, v };
  dibujarVista();
}, true);
function dibujarVista() {
  const a = arr, k = a.pv.viewport.scale;
  a.v.style.left = Math.min(a.x0, a.x1) * k + 'px'; a.v.style.top = Math.min(a.y0, a.y1) * k + 'px';
  a.v.style.width = Math.abs(a.x1 - a.x0) * k + 'px'; a.v.style.height = Math.abs(a.y1 - a.y0) * k + 'px';
}
document.addEventListener('pointermove', (e) => {
  if (!arr) return;
  const p = puntoEn(arr.pag, e.clientX, e.clientY); if (!p) return;
  arr.x1 = acotar(p.x, 0, arr.W); arr.y1 = acotar(p.y, 0, arr.H); dibujarVista();
}, true);
function soltar(cancelado) {
  const a = arr; if (!a) return; arr = null; a.v.remove();
  if (cancelado) return;
  const x = Math.min(a.x0, a.x1), y = Math.min(a.y0, a.y1), w = Math.abs(a.x1 - a.x0), h = Math.abs(a.y1 - a.y0);
  if (w < 4 || h < 4) return;
  crearRecuadro(a.n, { x, y, w, h }); commit();
}
document.addEventListener('pointerup', () => soltar(false), true);
document.addEventListener('pointercancel', () => soltar(true), true);
document.addEventListener('mousedown', (e) => {
  if (!activo || !e.target.closest) return;
  if (e.target.closest('#pdfViewer .page') && !e.target.closest('.it')) e.preventDefault();
}, true);
document.addEventListener('click', (e) => {
  if (!activo || !e.target.closest) return;
  if (e.target.closest('#pdfViewer .page') && !e.target.closest('.it')) { e.preventDefault(); e.stopPropagation(); }
}, true);

// x, y, w, h en puntos de la página tal como se ve a escala 1
export function crearRecuadro(pagina, r) {
  const pv = vistaPagina(pagina); if (pv && pv.pdfPage) E.paginas[pagina] = pv.pdfPage;
  const it = { id: E.sigId++, tipo: 'ocultar', pagina, x: r.x, y: r.y, w: Math.max(r.w, 1), h: Math.max(r.h, 1), color: '#000000' };
  E.items.push(it); sincronizar(); return it.id;
}

// Quita de los metadatos lo que suele delatar contenido: título, asunto, palabras clave (Info y XMP) y marcadores.
function limpiarMetadatos(doc) {
  const { PDFName } = PDFLib, ctx = doc.context;
  try {
    const info = ctx.lookup(ctx.trailerInfo.Info);
    if (info && typeof info.delete === 'function') for (const k of ['Title', 'Subject', 'Keywords']) info.delete(PDFName.of(k));
  } catch (e) { console.warn('info', e); }
  for (const k of ['Metadata', 'Outlines']) doc.catalog.delete(PDFName.of(k));
  const pm = doc.catalog.get(PDFName.of('PageMode'));
  if (pm && String(pm) === '/UseOutlines') doc.catalog.delete(PDFName.of('PageMode'));
}

// Aplica: cada página con recuadros pasa a ser una imagen (a 200 dpi) del mismo tamaño; las demás no se tocan.
// opt.limpiarMeta (por defecto sí): también borra título/asunto/palabras clave y marcadores.
export async function aplicarOcultar(confirmarAntes, opt = {}) {
  if (!listo() || !sinContrasena()) return false;
  const recuadros = hayRecuadros();
  const paginas = [...new Set(recuadros.map((i) => i.pagina))].sort((a, b) => a - b);
  if (!paginas.length) { toast(t('proteger.marqueAntes'), true); return false; }
  let limpiarMeta = opt.limpiarMeta !== false;
  if (confirmarAntes) {
    const txt = tn('proteger.laPagina', paginas.length, { pags: paginas.join(', ') });
    let extra = '';
    if (puente) {
      try {
        const info = await analizar(await bytesActuales({ desdeAplicarOcultar: true }));
        if (info && info.firmaDigital) extra += '\n' + t('proteger.extraFirma');
        if (info && info.formularios) extra += '\n' + t('proteger.extraForm');
      } catch (_) { /* nada */ }
    }
    const casilla = { texto: t('proteger.casillaMeta'), marcada: true };
    const ok = await confirmar(t('proteger.paraSiempre'),
      t('proteger.ocultarMsg', { txt, extra }),
      t('proteger.siOcultar'), t('proteger.noVolver'), casilla);
    if (!ok) return false;
    limpiarMeta = casilla.marcada;
  }
  const hecho = await cambiarDocumento(t('proteger.ocultando'), async (doc) => {
    // construirPdf no dibuja los recuadros "ocultar": se pintan aquí, justo antes de convertir la página en imagen
    const pgs = doc.getPages();
    for (const it of recuadros) {
      const pg = pgs[it.pagina - 1]; if (!pg) continue;
      const pp = await obtenerPagina(it.pagina);
      dibujarAnotacion(doc, pg, pp.getViewport({ scale: 1 }), it);
    }
    const bytes = await doc.save();
    const imgs = await paginasAImagen(bytes, paginas, 200, 0.8, t('proteger.ocultando'));
    progreso(t('proteger.armando'));
    const viejas = doc.getPages();
    const tags = new Set(), nuevas = new Map();
    // campos de las páginas ocultadas: se quitan enteros, o (si tienen widgets en otras páginas) se vacía su valor
    try { quitarCamposDe(doc, paginas.map((n) => viejas[n - 1]), { limpiarValor: true }); } catch (e) { console.warn('formulario', e); }
    for (const im of imgs) {
      const vieja = viejas[im.n - 1];
      const nueva = doc.insertPage(im.n - 1, [im.w, im.h]);          // la vieja queda en im.n
      const jpg = await doc.embedJpg(im.jpg);
      nueva.drawImage(jpg, { x: 0, y: 0, width: im.w, height: im.h });
      doc.removePage(im.n);
      tags.add(vieja.ref.tag); nuevas.set(vieja.ref.tag, nueva.ref);
    }
    for (const [tag, ref] of nuevas) { try { redirigirDestinos(doc, new Set([tag]), ref); } catch (e) { console.warn('destinos', e); } }
    // el árbol de estructura (accesibilidad) puede guardar el texto de las páginas reemplazadas
    const { PDFName } = PDFLib;
    doc.catalog.delete(PDFName.of('StructTreeRoot')); doc.catalog.delete(PDFName.of('MarkInfo'));
    if (limpiarMeta) limpiarMetadatos(doc);
    recolectarBasura(doc, tags);
  }, { desdeAplicarOcultar: true });
  if (hecho) { terminarOcultar(); toast(t('proteger.ocultoListo'), false, 7000); }
  return hecho;
}

E.aplicarOcultar = (opt) => aplicarOcultar(false, opt);

// ---------- tarjetas en Herramientas ----------
const G = 'Proteger';   // identificador del grupo (lo traduce herramientas.js)
registrarHerramienta({ id: 'proteger-comprimir', grupo: G, titulo: () => t('proteger.comprimir'), descripcion: () => t('proteger.comprimirDesc'), icono: 'comprimir', accion: comprimir });
registrarHerramienta({ id: 'proteger-poner', grupo: G, titulo: () => t('proteger.poner'), descripcion: () => t('proteger.ponerDesc'), icono: 'llave', accion: ponerContrasena });
registrarHerramienta({ id: 'proteger-quitar', grupo: G, titulo: () => t('proteger.quitar'), descripcion: () => t('proteger.quitarDesc'), icono: 'candadoabierto', accion: () => quitarContrasena(false) });
registrarHerramienta({ id: 'proteger-ocultar', grupo: G, titulo: () => t('proteger.ocultar'), descripcion: () => t('proteger.ocultarDesc'), icono: 'ocultar', accion: empezarOcultar });

// ganchos para pruebas (window.__fp)
window.__fp = Object.assign(window.__fp || {}, {
  async comprimir(nivel) { const r = await comprimirBytes(await bytesActuales(), nivel); finProgreso(); return { antes: r.antes, despues: r.despues, datos: r.datos }; },
  protegerBytes: (contrasena) => protegerBytes(contrasena),
  quitarContrasenaBytes,
  analizar,
  ocultar(pagina, rect) { const id = crearRecuadro(pagina, rect); commit(); return id; },
  aplicarOcultar: () => aplicarOcultar(false),
  empezarOcultar, quitarContrasena: () => quitarContrasena(false),
});
