// Fase 2 "Anotar": resaltar, subrayar, tachar, dibujar, rectángulo, flecha y notas.
// Todo son elementos del sistema de elementos.js (mover, borrar, deshacer y guardar funcionan igual que con la firma).
import { E, on } from './estado.js';
import { $, toast } from './util.js';
import { icono as svgIcono } from './iconos.js';
import { vistaPagina, renderAviso } from './visor.js';
import { commit } from './historial.js';
import { tipos, sincronizar, capaDe, cancelarColocar } from './elementos.js';
import { COLORES, POS_LINEA, simplificar, rutaSuave, rutaFlecha, paresDe } from './dibujo.js';
import { registrarHerramienta } from './herramientas.js';
import { agregar as agregarTextos, t } from './i18n.js';

agregarTextos({
  es: {
    'anotar.avisoResaltar': 'Arrastre sobre el texto que quiere resaltar', 'anotar.avisoSubrayar': 'Arrastre sobre el texto que quiere subrayar',
    'anotar.avisoTachar': 'Arrastre sobre el texto que quiere tachar', 'anotar.avisoDibujar': 'Mantenga apretado el botón y dibuje con el mouse',
    'anotar.avisoRect': 'Arrastre para dibujar un rectángulo', 'anotar.avisoFlecha': 'Arrastre desde donde sale hasta donde apunta la flecha',
    'anotar.avisoNota': 'Haga clic donde quiere poner la nota',
    'anotar.abraPdf': 'Abra un PDF primero.', 'anotar.tipoMal': 'Tipo de anotación desconocido: {tipo}',
    'anotar.notaHolder': 'Escriba aquí su nota', 'anotar.listo': 'Listo', 'anotar.cerrarNota': 'Cerrar la nota',
    'anotar.resaltar': 'Resaltar texto', 'anotar.resaltarDesc': 'Marque con color lo importante',
    'anotar.dibujar': 'Dibujar a mano', 'anotar.dibujarDesc': 'Haga trazos, círculos o rayas con el mouse',
  },
  en: {
    'anotar.avisoResaltar': 'Drag over the text you want to highlight', 'anotar.avisoSubrayar': 'Drag over the text you want to underline',
    'anotar.avisoTachar': 'Drag over the text you want to strike out', 'anotar.avisoDibujar': 'Hold the mouse button down and draw',
    'anotar.avisoRect': 'Drag to draw a rectangle', 'anotar.avisoFlecha': 'Drag from where the arrow starts to where it points',
    'anotar.avisoNota': 'Click where you want to put the note',
    'anotar.abraPdf': 'Please open a PDF first.', 'anotar.tipoMal': 'Unknown annotation type: {tipo}',
    'anotar.notaHolder': 'Type your note here', 'anotar.listo': 'Done', 'anotar.cerrarNota': 'Close the note',
    'anotar.resaltar': 'Highlight text', 'anotar.resaltarDesc': 'Mark what matters with color',
    'anotar.dibujar': 'Draw by hand', 'anotar.dibujarDesc': 'Make lines, circles or scribbles with the mouse',
  },
});

const NS = 'http://www.w3.org/2000/svg';
const HERR = {
  resaltar: { tipo: 'resaltar', aviso: 'anotar.avisoResaltar', modo: 'texto', color: 'amarillo' },
  subrayar: { tipo: 'subrayar', aviso: 'anotar.avisoSubrayar', modo: 'texto', color: 'rojo', grosores: [1, 2, 3.5] },
  tachar: { tipo: 'tachar', aviso: 'anotar.avisoTachar', modo: 'texto', color: 'rojo', grosores: [1, 2, 3.5] },
  dibujar: { tipo: 'trazo', aviso: 'anotar.avisoDibujar', modo: 'dibujo', color: 'rojo', grosores: [1.5, 3, 6] },
  rect: { tipo: 'rect', aviso: 'anotar.avisoRect', modo: 'dibujo', color: 'rojo', grosores: [1.5, 3, 6] },
  flecha: { tipo: 'flecha', aviso: 'anotar.avisoFlecha', modo: 'dibujo', color: 'rojo', grosores: [1.5, 3, 6] },
  nota: { tipo: 'nota', aviso: 'anotar.avisoNota', modo: 'dibujo', color: 'amarillo' },
};
const A = { herr: null, colores: {}, grosor: 1, abiertas: new Set() };
for (const k in HERR) A.colores[k] = HERR[k].color;
const NOTA_PT = 22;

// ---------- crear elementos (los usan el mouse y window.__fp.anotar) ----------
const colorHex = (nombre) => COLORES[nombre] || (/^#/.test(nombre || '') ? nombre : COLORES.rojo);
const grosorDe = (h) => { const g = HERR[h] && HERR[h].grosores; return g ? g[A.grosor] : 0; };
function agregar(it) { it.id = E.sigId++; E.items.push(it); const pv = vistaPagina(it.pagina); if (pv && pv.pdfPage) E.paginas[it.pagina] = pv.pdfPage; return it; }

// pagina: número; datos en puntos de la página tal como se ve a escala 1. Devuelve el id (sin deshacer: llamar commit()).
export function crearAnotacion(tipo, pagina, d = {}) {
  const color = colorHex(d.color || (tipo === 'nota' ? 'amarillo' : tipo === 'resaltar' ? 'amarillo' : 'rojo'));
  if (tipo === 'resaltar' || tipo === 'subrayar' || tipo === 'tachar' || tipo === 'rect') {
    const g = d.g || (tipo === 'rect' ? 3 : tipo === 'resaltar' ? 0 : 2);
    return agregar({ tipo, pagina, x: d.x, y: d.y, w: Math.max(d.w, 1), h: Math.max(d.h, 1), color, g }).id;
  }
  if (tipo === 'trazo') {
    let P = d.puntos || []; if (!P.length) return null;
    P = simplificar(P, 0.7); if (P.length === 1) P = [P[0], [P[0][0] + 0.1, P[0][1]]];
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
    return agregar({ tipo, pagina, x, y, w: Math.max(Math.max(...xs) - x, 1), h: Math.max(Math.max(...ys) - y, 1), color, g: d.g || 3, pts: P.flatMap((p) => [p[0] - x, p[1] - y]) }).id;
  }
  if (tipo === 'flecha') {
    const x = Math.min(d.x1, d.x2), y = Math.min(d.y1, d.y2);
    return agregar({ tipo, pagina, x, y, w: Math.max(Math.abs(d.x2 - d.x1), 1), h: Math.max(Math.abs(d.y2 - d.y1), 1), color, g: d.g || 3, pts: [d.x1 - x, d.y1 - y, d.x2 - x, d.y2 - y] }).id;
  }
  if (tipo === 'nota') {
    const it = agregar({ tipo, pagina, x: d.x, y: d.y, w: NOTA_PT, h: NOTA_PT, color, g: 0, texto: d.texto || '' });
    if (!it.texto) E.nuevos.add(it.id);
    return it.id;
  }
  throw new Error(t('anotar.tipoMal', { tipo }));
}

// ---------- cómo se ven en pantalla ----------
const svgEl = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
function conSvg(it, el) {
  const svg = svgEl('svg', { viewBox: `0 0 ${Math.max(it.w, 1)} ${Math.max(it.h, 1)}`, preserveAspectRatio: 'none' });
  el.appendChild(svg); return svg;
}
function trazoSvg(svg, d, it, rellenar) {
  const vis = svgEl('path', { d, fill: 'none', stroke: it.color, 'stroke-width': it.g, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const toque = svgEl('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(it.g, 12), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'toque' });
  svg.appendChild(vis); svg.appendChild(toque);
}
const dimSvg = (el, it, k) => { const s = el.querySelector('svg'); if (s) { s.setAttribute('width', Math.max(it.w, 1) * k); s.setAttribute('height', Math.max(it.h, 1) * k); } };

tipos.resaltar = {
  crear(it, el) { const r = document.createElement('div'); r.className = 'rell'; r.style.background = it.color; el.appendChild(r); },
  estilar() {},
};
for (const t of ['subrayar', 'tachar']) {
  tipos[t] = {
    crear(it, el) { const l = document.createElement('div'); l.className = 'lin'; l.style.background = it.color; el.appendChild(l); },
    estilar(el, it, k) { const l = el.querySelector('.lin'); l.style.height = Math.max(1, it.g * k) + 'px'; l.style.top = (it.h * POS_LINEA[t] - it.g / 2) * k + 'px'; },
  };
}
tipos.trazo = {
  crear(it, el) { const svg = conSvg(it, el); trazoSvg(svg, rutaSuave(paresDe(it.pts)), it); },
  estilar(el, it, k) { dimSvg(el, it, k); },
};
tipos.rect = {
  crear(it, el) {
    const svg = conSvg(it, el), d = `M 0 0 L ${it.w} 0 L ${it.w} ${it.h} L 0 ${it.h} Z`;
    trazoSvg(svg, d, it);
  },
  estilar(el, it, k) { dimSvg(el, it, k); },
};
tipos.flecha = {
  crear(it, el) { const svg = conSvg(it, el); trazoSvg(svg, rutaFlecha(it.pts[0], it.pts[1], it.pts[2], it.pts[3], it.g), it); },
  estilar(el, it, k) { dimSvg(el, it, k); },
};

function cerrarNota(it) {
  if (!E.items.includes(it)) { A.abiertas.delete(it.id); return; } // ya se quitó (p. ej. quedó vacía al perder el foco)
  A.abiertas.delete(it.id);
  const vacia = !String(it.texto || '').trim();
  if (vacia) {
    const enHist = !E.nuevos.has(it.id); E.nuevos.delete(it.id);
    E.items = E.items.filter((x) => x.id !== it.id); if (E.sel === it.id) E.sel = null;
    sincronizar(); if (enHist) commit();
  } else { E.nuevos.delete(it.id); sincronizar(); commit(); }
}
function alternarNota(it) { if (A.abiertas.has(it.id)) cerrarNota(it); else { A.abiertas.add(it.id); sincronizar(); enfocarNota(it.id); } }
function enfocarNota(id) { const el = E.els.get(id); const t = el && el.querySelector('textarea'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
tipos.nota = {
  crear(it, el) {
    const ic = document.createElement('div'); ic.className = 'icono'; ic.style.background = it.color; ic.innerHTML = svgIcono('nota', 24); el.appendChild(ic);
    const caja = document.createElement('div'); caja.className = 'nota-caja';
    const ta = document.createElement('textarea'); ta.placeholder = t('anotar.notaHolder'); ta.value = it.texto || ''; ta.spellcheck = true;
    const ok = document.createElement('button'); ok.textContent = t('anotar.listo'); ok.title = t('anotar.cerrarNota');
    caja.appendChild(ta); caja.appendChild(ok); el.appendChild(caja);
    let tc = 0;
    ta.addEventListener('input', () => { it.texto = ta.value; clearTimeout(tc); tc = setTimeout(() => { if (it.texto.trim()) { E.nuevos.delete(it.id); commit(); } }, 800); });
    ta.addEventListener('blur', () => { clearTimeout(tc); it.texto = ta.value; if (it.texto.trim()) { E.nuevos.delete(it.id); commit(); } else cerrarNota(it); });
    ok.addEventListener('pointerdown', (e) => e.stopPropagation());
    ok.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(tc); it.texto = ta.value; cerrarNota(it); });
    // un clic (sin arrastrar) sobre el globo abre o cierra el texto
    // (el elemento captura el puntero al moverse, así que el clic puede llegar al contenedor y no al globo)
    let px = 0, py = 0, desde = false;
    el.addEventListener('pointerdown', (e) => { desde = !e.target.closest('.nota-caja'); px = e.clientX; py = e.clientY; });
    el.addEventListener('click', (e) => {
      if (!desde || e.target.closest('.nota-caja')) return; desde = false;
      if (Math.hypot(e.clientX - px, e.clientY - py) <= 3) alternarNota(it);
    });
  },
  estilar(el, it, k) {
    const ic = el.querySelector('.icono'); ic.style.fontSize = Math.max(10, it.h * k * 0.62) + 'px'; ic.style.background = it.color;
    el.classList.toggle('abierta', A.abiertas.has(it.id));
    const ta = el.querySelector('textarea'); if (ta && document.activeElement !== ta && ta.value !== (it.texto || '')) ta.value = it.texto || '';
  },
};

// ---------- convertir coordenadas ----------
const paginaDe = (n) => document.querySelector(`#pdfViewer .page[data-page-number="${n}"]`);
function puntoEn(pag, cx, cy) {
  const n = +pag.dataset.pageNumber, pv = vistaPagina(n); if (!pv) return null;
  const r = pag.getBoundingClientRect(), k = pv.viewport.scale, f = r.width / pag.offsetWidth;
  return { n, k, f, r, x: (cx - r.left) / f / k, y: (cy - r.top) / f / k, W: pv.viewport.width / k, H: pv.viewport.height / k };
}
const acotar = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- resaltar / subrayar / tachar con el texto seleccionado ----------
function rectsDeSeleccion() {
  const sel = getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return [];
  const rango = sel.getRangeAt(0), res = [];
  let raiz = rango.commonAncestorContainer; if (raiz.nodeType === 3) raiz = raiz.parentNode;
  const tw = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const t = tw.currentNode; if (!rango.intersectsNode(t) || !t.textContent.trim()) continue;
    const capa = t.parentElement && t.parentElement.closest('.textLayer'); if (!capa) continue;
    const pag = capa.closest('.page'); if (!pag) continue;
    const r = document.createRange(); r.selectNodeContents(t);
    if (t === rango.startContainer) r.setStart(t, rango.startOffset);
    if (t === rango.endContainer) r.setEnd(t, rango.endOffset);
    for (const c of r.getClientRects()) if (c.width > 0.5 && c.height > 0.5) res.push({ c, pag });
  }
  return res;
}
// une los rectángulos de una misma línea → [{n, x, y, w, h}]
function lineasDe(rects) {
  const porPag = new Map();
  for (const { c, pag } of rects) { if (!porPag.has(pag)) porPag.set(pag, []); porPag.get(pag).push(c); }
  const out = [];
  for (const [pag, lista] of porPag) {
    const a = puntoEn(pag, 0, 0); if (!a) continue;
    const pts = lista.map((c) => ({ l: c.left, t: c.top, r: c.right, b: c.bottom })).sort((p, q) => p.t - q.t || p.l - q.l);
    const lineas = [];
    for (const p of pts) {
      const L = lineas.find((q) => {
        const sup = Math.max(q.t, p.t), inf = Math.min(q.b, p.b), alto = Math.min(q.b - q.t, p.b - p.t);
        return inf - sup > alto * 0.5 && p.l - q.r < (q.b - q.t) * 2 && q.l - p.r < (q.b - q.t) * 2;
      });
      if (L) { L.l = Math.min(L.l, p.l); L.r = Math.max(L.r, p.r); L.t = Math.min(L.t, p.t); L.b = Math.max(L.b, p.b); } else lineas.push({ ...p });
    }
    for (const L of lineas) {
      const p1 = puntoEn(pag, L.l, L.t), p2 = puntoEn(pag, L.r, L.b);
      const x1 = acotar(p1.x, 0, p1.W), y1 = acotar(p1.y, 0, p1.H), x2 = acotar(p2.x, 0, p1.W), y2 = acotar(p2.y, 0, p1.H);
      if (x2 - x1 > 1 && y2 - y1 > 1) out.push({ n: p1.n, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    }
  }
  return out.sort((a, b) => a.n - b.n || a.y - b.y || a.x - b.x);
}
function terminarTexto(h, ini, fin) {
  const def = HERR[h], color = A.colores[h], g = grosorDe(h);
  let lineas = lineasDe(rectsDeSeleccion());
  if (!lineas.length && ini && fin && ini.pag === fin.pag) { // sin texto: se usa el rectángulo arrastrado
    const a = puntoEn(ini.pag, ini.cx, ini.cy), b = puntoEn(ini.pag, fin.cx, fin.cy);
    const x = acotar(Math.min(a.x, b.x), 0, a.W), y = acotar(Math.min(a.y, b.y), 0, a.H), x2 = acotar(Math.max(a.x, b.x), 0, a.W), y2 = acotar(Math.max(a.y, b.y), 0, a.H);
    if (x2 - x > 3 && y2 - y > 3) lineas = [{ n: a.n, x, y, w: x2 - x, h: y2 - y }];
  }
  const sel = getSelection(); if (sel) sel.removeAllRanges();
  if (!lineas.length) return;
  for (const L of lineas) crearAnotacion(def.tipo, L.n, { x: L.x, y: L.y, w: L.w, h: L.h, color, g });
  sincronizar(); commit();
}

// ---------- dibujar, rectángulo, flecha, nota con el mouse ----------
let arrastre = null; // {h, pag, n, pts, ...}
function vistaPrevia(pag, W, H) {
  const pv = vistaPagina(+pag.dataset.pageNumber), capa = capaDe(pv);
  const svg = svgEl('svg', { class: 'vista-fp', viewBox: `0 0 ${W} ${H}`, width: W * pv.viewport.scale, height: H * pv.viewport.scale });
  capa.appendChild(svg); return svg;
}
function actualizarVista(a) {
  const g = grosorDe(a.h) || 3, color = colorHex(A.colores[a.h]); a.svg.innerHTML = '';
  let nodo;
  if (a.h === 'dibujar') nodo = svgEl('path', { d: rutaSuave(a.pts), fill: 'none' });
  else if (a.h === 'rect') nodo = svgEl('rect', { x: Math.min(a.x0, a.x1), y: Math.min(a.y0, a.y1), width: Math.abs(a.x1 - a.x0), height: Math.abs(a.y1 - a.y0), fill: 'none' });
  else nodo = svgEl('path', { d: rutaFlecha(a.x0, a.y0, a.x1, a.y1, g), fill: 'none' });
  nodo.setAttribute('stroke', color); nodo.setAttribute('stroke-width', g); nodo.setAttribute('stroke-linecap', 'round'); nodo.setAttribute('stroke-linejoin', 'round');
  a.svg.appendChild(nodo);
}
let textoIni = null;
document.addEventListener('pointerdown', (e) => {
  if (!A.herr || (e.button !== undefined && e.button !== 0)) return;
  const t = e.target; if (!t.closest) return;
  const pag = t.closest('#pdfViewer .page'); if (!pag || t.closest('.it') || t.closest('.ctl')) return;
  const def = HERR[A.herr];
  if (def.modo === 'texto') { textoIni = { pag, cx: e.clientX, cy: e.clientY }; return; } // la selección de texto la hace el navegador
  const p = puntoEn(pag, e.clientX, e.clientY); if (!p) return;
  e.preventDefault();
  if (A.herr === 'nota') {
    const id = crearAnotacion('nota', p.n, { x: acotar(p.x - NOTA_PT / 2, 0, p.W - NOTA_PT), y: acotar(p.y - NOTA_PT / 2, 0, p.H - NOTA_PT), color: A.colores.nota });
    A.abiertas.add(id); sincronizar(); enfocarNota(id); return;
  }
  try { pag.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
  arrastre = { h: A.herr, pag, n: p.n, W: p.W, H: p.H, pts: [[p.x, p.y]], x0: p.x, y0: p.y, x1: p.x, y1: p.y, svg: vistaPrevia(pag, p.W, p.H) };
  actualizarVista(arrastre);
}, true);
// con una herramienta activa, un clic sobre la página no abre enlaces ni campos del formulario
document.addEventListener('click', (e) => {
  if (!A.herr || !e.target.closest) return;
  if (e.target.closest('#pdfViewer .page') && !e.target.closest('.it')) { e.preventDefault(); e.stopPropagation(); }
}, true);
// el arrastre con el mouse no debe seleccionar texto ni enfocar formularios
document.addEventListener('mousedown', (e) => {
  if (!A.herr || HERR[A.herr].modo !== 'dibujo') return;
  if (e.target.closest && e.target.closest('#pdfViewer .page') && !e.target.closest('.it')) e.preventDefault();
}, true);
document.addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const p = puntoEn(arrastre.pag, e.clientX, e.clientY); if (!p) return;
  const a = arrastre; a.x1 = acotar(p.x, 0, a.W); a.y1 = acotar(p.y, 0, a.H);
  if (a.h === 'dibujar') { const u = a.pts[a.pts.length - 1]; if (Math.hypot(a.x1 - u[0], a.y1 - u[1]) >= 1) a.pts.push([a.x1, a.y1]); }
  actualizarVista(a);
}, true);
function terminarArrastre(cancelado) {
  const a = arrastre; if (!a) return; arrastre = null; a.svg.remove();
  if (cancelado) return;
  const color = A.colores[a.h], g = grosorDe(a.h);
  if (a.h === 'dibujar') {
    let largo = 0; for (let i = 1; i < a.pts.length; i++) largo += Math.hypot(a.pts[i][0] - a.pts[i - 1][0], a.pts[i][1] - a.pts[i - 1][1]);
    if (a.pts.length < 2 || largo <= 2) return; // un clic sin mover no deja trazo
    crearAnotacion('trazo', a.n, { puntos: a.pts, color, g });
  }
  else if (a.h === 'rect') {
    const x = Math.min(a.x0, a.x1), y = Math.min(a.y0, a.y1), w = Math.abs(a.x1 - a.x0), h = Math.abs(a.y1 - a.y0);
    if (w < 4 || h < 4) return; crearAnotacion('rect', a.n, { x, y, w, h, color, g });
  } else {
    if (Math.hypot(a.x1 - a.x0, a.y1 - a.y0) < 6) return;
    crearAnotacion('flecha', a.n, { x1: a.x0, y1: a.y0, x2: a.x1, y2: a.y1, color, g });
  }
  sincronizar(); commit();
}
document.addEventListener('pointerup', (e) => {
  if (arrastre) { terminarArrastre(false); return; }
  if (A.herr && HERR[A.herr].modo === 'texto' && textoIni) {
    const ini = textoIni, h = A.herr; textoIni = null;
    setTimeout(() => terminarTexto(h, ini, { cx: e.clientX, cy: e.clientY, pag: e.target.closest && e.target.closest('#pdfViewer .page') }), 0);
  }
}, true);
document.addEventListener('pointercancel', () => terminarArrastre(true), true);

// ---------- barra de anotar ----------
const barra = $('barraAnotar');
function pintarBarra() {
  barra.querySelectorAll('.herr').forEach((b) => b.classList.toggle('on', b.dataset.herr === A.herr));
  const h = A.herr, def = h && HERR[h];
  barra.querySelectorAll('.col').forEach((b) => b.classList.toggle('on', !!h && b.dataset.color === A.colores[h]));
  $('grosoresAnotar').classList.toggle('oculto', !(def && def.grosores));
  barra.querySelectorAll('.gr').forEach((b) => b.classList.toggle('on', +b.dataset.g === A.grosor));
}
export function elegirHerramienta(h, forzar) {
  if (h && !E.pdf) { toast(t('anotar.abraPdf'), true); return; }
  if (h) { cancelarColocar(); abrirAnotar(true, true); }
  if (A.herr === h && !forzar) h = null;
  A.herr = h; E.herr = h;
  document.body.classList.toggle('anotando', !!h);
  document.body.classList.toggle('anot-texto', !!h && HERR[h].modo === 'texto');
  document.body.classList.toggle('anot-dibujo', !!h && HERR[h].modo === 'dibujo');
  E.avisoHerr = h ? t(HERR[h].aviso) : ''; renderAviso(); pintarBarra();
  const s = getSelection(); if (s) s.removeAllRanges();
}
export function abrirAnotar(ver, sinReiniciar) {
  const v = ver === undefined ? barra.classList.contains('hidden') : !!ver;
  if (v && !E.pdf) { toast(t('anotar.abraPdf'), true); return; }
  if (v && !sinReiniciar) cancelarColocar();
  barra.classList.toggle('hidden', !v); $('bAnotar').classList.toggle('on', v);
  if (!v && A.herr) { A.herr = null; E.herr = null; E.avisoHerr = ''; document.body.classList.remove('anotando', 'anot-texto', 'anot-dibujo'); renderAviso(); }
  if (v) pintarBarra();
}
$('bAnotar').onclick = () => abrirAnotar();
$('bCerrarAnotar').onclick = () => abrirAnotar(false);
barra.querySelectorAll('.herr').forEach((b) => { b.onclick = () => elegirHerramienta(b.dataset.herr); });
barra.querySelectorAll('.col').forEach((b) => { b.onclick = () => { if (A.herr) { A.colores[A.herr] = b.dataset.color; } pintarBarra(); }; });
barra.querySelectorAll('.gr').forEach((b) => { b.onclick = () => { A.grosor = +b.dataset.g; pintarBarra(); }; });
on('cerrarAnotar', () => abrirAnotar(false));
// al cambiar de idioma: el aviso de la herramienta activa y los textos de las notas ya dibujadas
on('idioma', () => {
  if (A.herr) { E.avisoHerr = t(HERR[A.herr].aviso); renderAviso(); }
  document.querySelectorAll('.nota-caja').forEach((c) => {
    const ta = c.querySelector('textarea'), ok = c.querySelector('button');
    if (ta) ta.placeholder = t('anotar.notaHolder');
    if (ok) { ok.textContent = t('anotar.listo'); ok.title = t('anotar.cerrarNota'); }
  });
});
// al empezar a firmar / escribir texto / poner fecha se deja de anotar
for (const id of ['bFirmar', 'bTexto', 'bFecha']) $(id).addEventListener('click', () => { if (A.herr) elegirHerramienta(null); }, true);
// Esc cierra la barra (si no hay ventanas abiertas ni se está colocando algo)
addEventListener('keydown', (e) => {
  if ((e.key || '') !== 'Escape') return;
  if (document.querySelector('.modal:not(.hidden)') || E.colocando) return;
  // un Esc cierra una sola cosa: nota en edición → búsqueda (si tiene el foco) → herramienta → barra
  const a = document.activeElement;
  if (a && a.tagName === 'TEXTAREA') {
    const el = a.closest('.it'), it = el && E.items.find((x) => E.els.get(x.id) === el && x.tipo === 'nota');
    if (it) { e.stopImmediatePropagation(); a.blur(); cerrarNota(it); }
    return;
  }
  if (!$('barraBuscar').classList.contains('hidden') && a && a.id === 'buscarInput') return;
  if (A.herr) { e.stopImmediatePropagation(); elegirHerramienta(null); return; }
  if (!barra.classList.contains('hidden')) { e.stopImmediatePropagation(); abrirAnotar(false); }
}, true);
on('documentoCargado', ({ conservar }) => { if (!conservar) { A.abiertas.clear(); } });

// ---------- tarjetas en Herramientas ----------
registrarHerramienta({ id: 'anotar-resaltar', grupo: 'Anotar', titulo: () => t('anotar.resaltar'), descripcion: () => t('anotar.resaltarDesc'), icono: 'anotar', accion: () => elegirHerramienta('resaltar', true) });
registrarHerramienta({ id: 'anotar-dibujar', grupo: 'Anotar', titulo: () => t('anotar.dibujar'), descripcion: () => t('anotar.dibujarDesc'), icono: 'dibujar', accion: () => elegirHerramienta('dibujar', true) });
