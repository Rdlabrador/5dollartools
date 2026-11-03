// Panel lateral de miniaturas: ver, marcar, girar, borrar, extraer, insertar en blanco y reordenar páginas.
import { E, on } from './estado.js';
import { agregar, t, tn } from './i18n.js';
import { $, toast } from './util.js';
import { icono as svgIcono } from './iconos.js';
import { pdfViewer } from './visor.js';
import { nPaginas, accionGirar, accionBorrar, accionExtraer, desplazar, reordenar, insertarBlanco } from './paginas.js';

agregar({
  es: {
    'miniaturas.girar': 'Girar', 'miniaturas.girarDer': 'Girar a la derecha', 'miniaturas.girarIzq': 'Girar a la izquierda',
    'miniaturas.borrar': 'Borrar', 'miniaturas.borrarTit': 'Borrar las páginas marcadas',
    'miniaturas.extraer': 'Extraer', 'miniaturas.extraerTit': 'Guardar las páginas marcadas en un PDF nuevo',
    'miniaturas.subir': 'Subir', 'miniaturas.subirTit': 'Subir un lugar', 'miniaturas.bajar': 'Bajar', 'miniaturas.bajarTit': 'Bajar un lugar',
    'miniaturas.blanco': 'Insertar página en blanco', 'miniaturas.blancoTit': 'Agrega una página en blanco después de la marcada',
    'miniaturas.todas': 'Marcar todas', 'miniaturas.todasTit': 'Marcar todas las páginas',
    'miniaturas.quitar': 'Quitar marcas', 'miniaturas.quitarTit': 'Desmarcar todas',
    'miniaturas.marcadas.1': '1 página marcada', 'miniaturas.marcadas.n': '{n} páginas marcadas',
    'miniaturas.toque': 'Toque una página para marcarla', 'miniaturas.marcarEsta': 'Marcar esta página',
  },
  en: {
    'miniaturas.girar': 'Rotate', 'miniaturas.girarDer': 'Rotate to the right', 'miniaturas.girarIzq': 'Rotate to the left',
    'miniaturas.borrar': 'Delete', 'miniaturas.borrarTit': 'Delete the marked pages',
    'miniaturas.extraer': 'Extract', 'miniaturas.extraerTit': 'Save the marked pages in a new PDF',
    'miniaturas.subir': 'Move up', 'miniaturas.subirTit': 'Move up one place', 'miniaturas.bajar': 'Move down', 'miniaturas.bajarTit': 'Move down one place',
    'miniaturas.blanco': 'Insert blank page', 'miniaturas.blancoTit': 'Add a blank page after the marked one',
    'miniaturas.todas': 'Mark all', 'miniaturas.todasTit': 'Mark all the pages',
    'miniaturas.quitar': 'Clear marks', 'miniaturas.quitarTit': 'Unmark all pages',
    'miniaturas.marcadas.1': '1 page marked', 'miniaturas.marcadas.n': '{n} pages marked',
    'miniaturas.toque': 'Tap a page to mark it', 'miniaturas.marcarEsta': 'Mark this page',
  },
});

const ANCHO = 140; // px CSS de cada miniatura
const panel = $('miniaturas');
const barra = document.createElement('div'); barra.className = 'mini-barra';
const info = document.createElement('div'); info.className = 'mini-info';
const cuerpo = document.createElement('div'); cuerpo.className = 'mini-lista';
panel.append(barra, cuerpo);

function boton(texto, titulo, fn, clase = '', ic = '') {
  const b = document.createElement('button'); b.className = 'btn mini-btn ' + clase; b.textContent = texto; if (ic) b.insertAdjacentHTML('afterbegin', svgIcono(ic, 22)); b.title = titulo; b.onclick = fn; return b;
}
const marcadas = () => [...E.seleccionPaginas].sort((a, b) => a - b);
const queMarcadas = () => (marcadas().length ? marcadas() : (E.pdf ? [pdfViewer.currentPageNumber] : []));
const fila = (...b) => { const d = document.createElement('div'); d.className = 'mini-fila'; d.append(...b); return d; };
function armarBarra() {
  barra.textContent = '';
  barra.append(
    info,
    fila(boton(t('miniaturas.girar'), t('miniaturas.girarDer'), () => accionGirar(queMarcadas(), 90), '', 'girarder'), boton(t('miniaturas.girar'), t('miniaturas.girarIzq'), () => accionGirar(queMarcadas(), -90), '', 'girarizq')),
    fila(boton(t('miniaturas.borrar'), t('miniaturas.borrarTit'), () => accionBorrar(queMarcadas()), 'peligro'), boton(t('miniaturas.extraer'), t('miniaturas.extraerTit'), () => accionExtraer(queMarcadas()))),
    fila(boton(t('miniaturas.subir'), t('miniaturas.subirTit'), () => desplazar(queMarcadas(), -1)), boton(t('miniaturas.bajar'), t('miniaturas.bajarTit'), () => desplazar(queMarcadas(), 1))),
    fila(boton(t('miniaturas.blanco'), t('miniaturas.blancoTit'), () => {
      const m = marcadas(); insertarBlanco(m.length ? m[m.length - 1] : pdfViewer.currentPageNumber);
    }, 'ancho')),
    fila(boton(t('miniaturas.todas'), t('miniaturas.todasTit'), () => poner(Array.from({ length: nPaginas() }, (_, i) => i + 1))), boton(t('miniaturas.quitar'), t('miniaturas.quitarTit'), () => poner([]))),
  );
}
armarBarra();

let miniaturas = [];   // [{div, canvas, chk, hecho}]
let ancla = 1;         // para Shift
let ficha = 0;         // cambia al rehacer la lista: descarta dibujos pendientes
let visibles = new Set();           // páginas cerca de la vista (por dibujar)
let actual = null, tareaRender = null; // un solo dibujante a la vez; tarea de pdf.js en curso
let observador = null, lejano = null;

function poner(sel) { E.seleccionPaginas = sel; pintar(); }
function pintar() {
  const sel = new Set(E.seleccionPaginas), actual = E.pdf ? pdfViewer.currentPageNumber : 0;
  miniaturas.forEach((m, i) => {
    const n = i + 1, s = sel.has(n);
    m.div.classList.toggle('sel', s); m.div.classList.toggle('actual', n === actual); m.chk.checked = s;
  });
  const k = sel.size;
  info.textContent = k ? tn('miniaturas.marcadas', k) : t('miniaturas.toque');
}

function alternar(n) { const s = new Set(E.seleccionPaginas); s.has(n) ? s.delete(n) : s.add(n); ancla = n; poner([...s]); }
function alClic(n, e) {
  if (e.shiftKey) {
    const a = Math.min(ancla, n), b = Math.max(ancla, n), s = new Set(e.ctrlKey || e.metaKey ? E.seleccionPaginas : []);
    for (let i = a; i <= b; i++) s.add(i);
    poner([...s]);
  } else if (e.ctrlKey || e.metaKey) alternar(n);
  else { ancla = n; poner([n]); if (E.pdf) pdfViewer.currentPageNumber = n; }
}

// ---- dibujo perezoso ----
// la miniatura pendiente más cercana al centro de la vista (0 si no hay)
function siguiente() {
  const pr = panel.getBoundingClientRect(), cy = pr.top + pr.height / 2;
  let mejor = 0, dm = Infinity;
  for (const n of visibles) {
    const m = miniaturas[n - 1]; if (!m || m.hecho) continue;
    const r = m.div.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - cy);
    if (d < dm) { dm = d; mejor = n; }
  }
  return mejor;
}
// libera el lienzo de una miniatura lejana; se volverá a dibujar si regresa a la vista
function liberar(n) {
  const m = miniaturas[n - 1]; if (!m || !m.hecho) return;
  m.canvas.width = m.canvas.height = 0; m.hecho = false; m.div.classList.remove('lista');
}
async function bombear() {
  if (actual) return;
  const mio = actual = {}, mi = ficha;
  try {
    while (actual === mio && mi === ficha) {
      const n = siguiente(); if (!n) return;
      const m = miniaturas[n - 1];
      if (!E.pdf || n > E.pdf.numPages) { m.hecho = true; continue; } // la lista aún es de un documento anterior
      try {
        const pag = await E.pdf.getPage(n);
        if (actual !== mio || mi !== ficha) return;
        const v1 = pag.getViewport({ scale: 1 }), dpr = Math.min(2, window.devicePixelRatio || 1);
        const vp = pag.getViewport({ scale: ANCHO * dpr / v1.width });
        m.canvas.width = Math.round(vp.width); m.canvas.height = Math.round(vp.height);
        m.canvas.style.aspectRatio = `${v1.width} / ${v1.height}`;
        m.imagen.style.aspectRatio = `${v1.width} / ${v1.height}`;
        const ctx = m.canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, m.canvas.width, m.canvas.height);
        tareaRender = pag.render({ canvasContext: ctx, viewport: vp });
        await tareaRender.promise; tareaRender = null;
        pag.cleanup();
        if (mi !== ficha) return;
        m.hecho = true; m.div.classList.add('lista');
      } catch (e) {
        tareaRender = null;
        if (mi !== ficha || actual !== mio) return;
        if (e && e.name === 'RenderingCancelledException') continue;
        m.hecho = true; console.warn('miniatura', n, e);
      }
      await new Promise((r) => setTimeout(r, 0)); // deja respirar a la pantalla
    }
  } finally { if (actual === mio) actual = null; if (mi === ficha && siguiente()) bombear(); }
}

// ---- arrastrar para reordenar ----
let arrastrando = null, indicador = null;
function limpiarIndicador() { if (indicador) { indicador.div.classList.remove('antes', 'despues'); indicador = null; } }
function lugar(e, div) { const r = div.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 ? 'antes' : 'despues'; }

function construir() {
  ficha++; visibles = new Set(); actual = null;
  if (tareaRender) { try { tareaRender.cancel(); } catch (_) { /* nada */ } tareaRender = null; }
  if (observador) observador.disconnect();
  if (lejano) lejano.disconnect();
  cuerpo.innerHTML = ''; miniaturas = [];
  const n = nPaginas();
  observador = new IntersectionObserver((es) => {
    for (const x of es) { const num = +x.target.dataset.n; if (x.isIntersecting) visibles.add(num); else visibles.delete(num); }
    if (visibles.size) bombear();
  }, { root: panel, rootMargin: '300px 0px' });
  lejano = new IntersectionObserver((es) => { // más de ~3 pantallas lejos: se libera la memoria del lienzo
    for (const x of es) if (!x.isIntersecting) liberar(+x.target.dataset.n);
  }, { root: panel, rootMargin: '300% 0px' });
  for (let i = 1; i <= n; i++) {
    const div = document.createElement('div'); div.className = 'mini'; div.dataset.n = i; div.draggable = true;
    const imagen = document.createElement('div'); imagen.className = 'mini-img'; imagen.style.width = ANCHO + 'px';
    const canvas = document.createElement('canvas'); imagen.appendChild(canvas);
    const lab = document.createElement('label'); lab.className = 'mini-chk'; lab.title = t('miniaturas.marcarEsta');
    const chk = document.createElement('input'); chk.type = 'checkbox'; lab.appendChild(chk);
    lab.onclick = (e) => e.stopPropagation();
    chk.onchange = () => alternar(i);
    const num = document.createElement('div'); num.className = 'mini-num'; num.textContent = i;
    div.append(lab, imagen, num);
    div.onclick = (e) => alClic(i, e);
    div.ondragstart = (e) => {
      if (!E.seleccionPaginas.includes(i)) poner([i]);
      arrastrando = marcadas(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'paginas');
    };
    div.ondragover = (e) => {
      if (!arrastrando) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      const l = lugar(e, div);
      if (!indicador || indicador.div !== div || indicador.l !== l) { limpiarIndicador(); div.classList.add(l); indicador = { div, l }; }
    };
    div.ondrop = (e) => {
      if (!arrastrando) return; e.preventDefault();
      const l = lugar(e, div), antesDe = l === 'antes' ? i : i + 1, mover = arrastrando;
      arrastrando = null; limpiarIndicador();
      reordenar(mover, antesDe).catch((x) => toast(String(x.message || x), true));
    };
    div.ondragend = () => { arrastrando = null; limpiarIndicador(); };
    cuerpo.appendChild(div); observador.observe(div); lejano.observe(div);
    miniaturas.push({ div, canvas, imagen, chk, hecho: false });
  }
  pintar();
}
// desplazamiento automático al arrastrar cerca de los bordes
panel.addEventListener('dragover', (e) => {
  if (!arrastrando) return; const r = panel.getBoundingClientRect();
  if (e.clientY < r.top + 60) panel.scrollTop -= 18; else if (e.clientY > r.bottom - 60) panel.scrollTop += 18;
});

on('documentoCargado', ({ conservar, paginas }) => {
  E.seleccionPaginas = conservar ? E.seleccionPaginas.filter((p) => p <= paginas) : [];
  construir();
});
on('seleccionPaginas', pintar);
on('paginaCambio', (n) => {
  pintar();
  const m = miniaturas[n - 1];
  if (m && document.body.classList.contains('con-miniaturas')) m.div.scrollIntoView({ block: 'nearest' });
});
on('miniaturas', (ver) => { if (ver && E.pdf) { pintar(); const m = miniaturas[pdfViewer.currentPageNumber - 1]; if (m) m.div.scrollIntoView({ block: 'nearest' }); } });
on('idioma', () => {
  armarBarra(); pintar();
  cuerpo.querySelectorAll('.mini-chk').forEach((l) => { l.title = t('miniaturas.marcarEsta'); });
});
