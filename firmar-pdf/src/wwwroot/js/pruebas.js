// Ganchos para pruebas automáticas (window.__fp). No los usa la interfaz.
import { E } from './estado.js';
import { cargarImagen, elegir, pedirTexto, pedirRangoPaginas, progreso, finProgreso } from './util.js';
import { pedir } from './puente.js';
import { cargarPDF, cambiarDocumento, reemplazarDocumento, bytesActuales } from './documento.js';
import { sincronizar } from './elementos.js';
import { commit, deshacer, rehacer, sucio } from './historial.js';
import { construirPdf, obtenerPagina } from './guardar.js';
import { registrarHerramienta, herramientasRegistradas, abrirHerramientas } from './herramientas.js';
import { crearAnotacion } from './anotar.js';
import { buscar } from './buscar.js';
import { aplicarMarcaAgua, numerarPaginas } from './marcas.js';

window.__fp = {
  async cargar(bytes, nombre) { return cargarPDF(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), nombre || 'prueba.pdf'); },
  items() {
    return E.items.map((i) => {
      const o = { id: i.id, tipo: i.tipo, pagina: i.pagina, x: i.x, y: i.y, w: i.w, h: i.h, texto: i.texto, size: i.size };
      if (E.paginas[i.pagina]) { const [px, py] = E.paginas[i.pagina].getViewport({ scale: 1 }).convertToPdfPoint(i.x, i.y + i.h); o.xPdf = px; o.yPdf = py; }
      return o;
    });
  },
  // (xPdf, yPdf) = punto PDF de la esquina inferior izquierda de la firma
  async colocarFirma(dataURL, pagina, xPdf, yPdf, anchoPdf) {
    const img = await cargarImagen(dataURL); const w = anchoPdf, h = w * img.naturalHeight / img.naturalWidth;
    const pp = await obtenerPagina(pagina); const [vx, vy] = pp.getViewport({ scale: 1 }).convertToViewportPoint(xPdf, yPdf);
    const it = { id: E.sigId++, tipo: 'firma', pagina, x: vx, y: vy - h, w, h, png: dataURL };
    E.items.push(it); sincronizar(); commit(); return it.id;
  },
  async colocarTexto(texto, pagina, xPdf, yPdf, size = 14) {
    const pp = await obtenerPagina(pagina); const [vx, vy] = pp.getViewport({ scale: 1 }).convertToViewportPoint(xPdf, yPdf);
    const it = { id: E.sigId++, tipo: 'texto', pagina, x: vx, y: vy - size, w: 0, h: size, size, texto };
    E.items.push(it); sincronizar(); commit(); return it.id;
  },
  deshacer, rehacer, sucio: () => !!(E.pdf && sucio()),
  estado: () => ({ sucio: sucio(), protegido: E.protegido, paginas: E.pdf ? E.pdf.numPages : 0, historial: E.hist.length, idx: E.histIdx, docs: E.docs.size, docId: E.docId }),
  bytesFinales(final) { return construirPdf(!!final); },
  // nuevas (editor completo)
  cambiarDocumento, reemplazarDocumento, bytesActuales,
  pedir, elegir, pedirTexto, pedirRangoPaginas, progreso, finProgreso,
  registrarHerramienta, herramientas: herramientasRegistradas, abrirHerramientas,
  // fase 2 (anotar): tipos 'resaltar','subrayar','tachar','trazo','rect','flecha','nota'; datos en puntos de la página a escala 1 (como se ve)
  anotar(tipo, pagina, datos) { const id = crearAnotacion(tipo, pagina, datos || {}); sincronizar(); commit(); return id; },
  buscar, marcaAgua: aplicarMarcaAgua, numerarPaginas,
};
