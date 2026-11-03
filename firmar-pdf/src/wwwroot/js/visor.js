// Visor de PDF (pdf.js): zoom, texto de páginas y barra de avisos.
import * as pdfjsLib from '../lib/pdfjs/build/pdf.min.mjs';
import { E, emit, on } from './estado.js';
import { $, textoDe } from './util.js';
import { agregar, t } from './i18n.js';

agregar({
  es: { 'visor.pagina': 'Página {n} de {total}', 'visor.cancelarEsc': 'Cancelar (Esc)', 'visor.terminarEsc': 'Terminar (Esc)' },
  en: { 'visor.pagina': 'Page {n} of {total}', 'visor.cancelarEsc': 'Cancel (Esc)', 'visor.terminarEsc': 'Done (Esc)' },
});

globalThis.pdfjsLib = pdfjsLib; // pdf_viewer.mjs lo necesita antes de cargarse
const { EventBus, PDFViewer, PDFLinkService, PDFFindController } = await import('../lib/pdfjs/web/pdf_viewer.mjs');
export { pdfjsLib };

export const base = new URL('../', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'lib/pdfjs/build/pdf.worker.min.mjs';
export const OPC_PDF = {
  cMapUrl: base + 'lib/pdfjs/cmaps/', cMapPacked: true,
  standardFontDataUrl: base + 'lib/pdfjs/standard_fonts/',
  wasmUrl: base + 'lib/pdfjs/wasm/', iccUrl: base + 'lib/pdfjs/iccs/',
};

export const eventBus = new EventBus();
export const linkService = new PDFLinkService({ eventBus });
export const findController = new PDFFindController({ linkService, eventBus });
export const pdfViewer = new PDFViewer({
  container: $('contenedor'), viewer: $('pdfViewer'), eventBus, linkService, findController,
  annotationMode: pdfjsLib.AnnotationMode.ENABLE_FORMS,
  imageResourcesPath: base + 'lib/pdfjs/web/images/',
  textLayerMode: 1,
});
linkService.setViewer(pdfViewer);

export function textoPaginas() { $('paginaTxt').textContent = E.pdf ? t('visor.pagina', { n: pdfViewer.currentPageNumber, total: pdfViewer.pagesCount }) : ' '; }

eventBus.on('pagesinit', () => {
  pdfViewer.currentScaleValue = 'page-width'; E.ajustar = true;
  for (let i = 0; i < pdfViewer.pagesCount; i++) {
    const pv = pdfViewer.getPageView(i);
    if (pv && pv.div) new MutationObserver(() => emit('programarSync')).observe(pv.div, { childList: true });
  }
  textoPaginas(); if (E.resolverPaginas) { E.resolverPaginas(); E.resolverPaginas = null; }
  emit('paginasListas');
});
eventBus.on('pagechanging', () => { textoPaginas(); emit('paginaCambio', pdfViewer.currentPageNumber); });
eventBus.on('scalechanging', (e) => { $('zoomTxt').textContent = Math.round(e.scale * 100) + ' %'; emit('sincronizar'); });
eventBus.on('pagerendered', (e) => {
  const pv = pdfViewer.getPageView(e.pageNumber - 1); if (pv && pv.pdfPage) E.paginas[e.pageNumber] = pv.pdfPage;
  emit('sincronizar'); emit('paginaRenderizada', e.pageNumber);
});

export function zoom(dir) {
  if (!E.pdf) return; E.ajustar = false;
  const n = pdfViewer.currentScale * (dir > 0 ? 1.2 : 1 / 1.2);
  pdfViewer.currentScale = Math.min(4, Math.max(0.25, Math.round(n * 100) / 100));
}
export function ajustarAncho() { if (!E.pdf) return; E.ajustar = true; pdfViewer.currentScaleValue = 'page-width'; }
$('bZoomMas').onclick = () => zoom(1);
$('bZoomMenos').onclick = () => zoom(-1);
$('bAncho').onclick = ajustarAncho;
$('contenedor').addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1 : -1); } }, { passive: false });
let tResize = 0;
new ResizeObserver(() => { if (!E.pdf || !E.ajustar) return; cancelAnimationFrame(tResize); tResize = requestAnimationFrame(() => { pdfViewer.currentScaleValue = 'page-width'; }); }).observe($('contenedor'));

export const vistaPagina = (n) => E.pdf ? pdfViewer.getPageView(n - 1) : null;
export const escalaPx = () => pdfViewer.currentScale * (96 / 72);

// ---------- avisos ----------
export function renderAviso() {
  const a = $('aviso'); a.innerHTML = '';
  if (E.colocando) {
    a.className = 'colocando';
    const s = document.createElement('span'); s.textContent = textoDe(E.colocando.aviso); a.appendChild(s);
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = t('visor.cancelarEsc'); b.onclick = () => emit('cancelarColocar'); a.appendChild(b);
  } else if (E.avisoHerr) {
    a.className = 'colocando';
    const s = document.createElement('span'); s.textContent = textoDe(E.avisoHerr); a.appendChild(s);
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = t('visor.terminarEsc'); b.onclick = () => emit('cerrarAnotar'); a.appendChild(b);
  } else if (E.avisoFijo) {
    a.className = ''; const s = document.createElement('span'); s.className = 'grow'; s.textContent = textoDe(E.avisoFijo); a.appendChild(s);
  } else a.className = 'hidden';
}

// al cambiar el idioma se vuelve a pintar lo que está en pantalla: indicador de página y avisos
on('idioma', () => { textoPaginas(); renderAviso(); });
