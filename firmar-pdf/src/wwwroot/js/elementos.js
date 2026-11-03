// Elementos colocados sobre las páginas (firmas y textos) y el modo "colocar".
import { E, on, ANCHO_FIRMA_PT } from './estado.js';
import { $, fechaHoy } from './util.js';
import { ICONOS, icono as svgIcono } from './iconos.js';
import { vistaPagina, escalaPx, renderAviso } from './visor.js';
import { commit } from './historial.js';
import { agregar, t } from './i18n.js';

agregar({
  es: {
    'elementos.cambiarTam': 'Arrastre para cambiar el tamaño',
    'elementos.mover': 'Mover', 'elementos.letraMenor': 'Letra más chica', 'elementos.letraMayor': 'Letra más grande', 'elementos.borrar': 'Borrar',
    'elementos.clicFirma': 'Haga clic donde quiere la firma',
    'elementos.clicFecha': 'Haga clic donde quiere la fecha',
    'elementos.clicTexto': 'Haga clic donde quiere escribir',
    'elementos.clicImagen': 'Haga clic donde quiere la foto',
    'elementos.clicImagenN': 'Foto {i} de {n}: haga clic donde la quiere',
    'elementos.texto': 'Texto',
  },
  en: {
    'elementos.cambiarTam': 'Drag to resize',
    'elementos.mover': 'Move', 'elementos.letraMenor': 'Smaller text', 'elementos.letraMayor': 'Larger text', 'elementos.borrar': 'Delete',
    'elementos.clicFirma': 'Click where you want the signature',
    'elementos.clicFecha': 'Click where you want the date',
    'elementos.clicTexto': 'Click where you want to type',
    'elementos.clicImagen': 'Click where you want the photo',
    'elementos.clicImagenN': 'Photo {i} of {n}: click where you want it',
    'elementos.texto': 'Text',
  },
});

// Tipos de elemento extra (anotaciones): tipos[tipo] = { crear(it, el, ctl), estilar(el, it, k) } (los registra anotar.js)
export const tipos = {};

// ---------- elementos sobre las páginas ----------
let tSync = 0;
export function programarSync() { cancelAnimationFrame(tSync); tSync = requestAnimationFrame(sincronizar); }
export function capaDe(pv) {
  let c = pv.div.querySelector(':scope > .capa-fp');
  if (!c) { c = document.createElement('div'); c.className = 'capa-fp'; pv.div.appendChild(c); }
  return c;
}
export function sincronizar() {
  if (!E.pdf) return;
  const vivos = new Set(E.items.map((i) => i.id));
  for (const [id, el] of E.els) if (!vivos.has(id)) { el.remove(); E.els.delete(id); }
  for (const it of E.items) {
    const pv = vistaPagina(it.pagina); if (!pv || !pv.div) continue;
    if (pv.pdfPage) E.paginas[it.pagina] = pv.pdfPage;
    const capa = capaDe(pv);
    let el = E.els.get(it.id);
    if (!el) { el = crearElemento(it); E.els.set(it.id, el); }
    if (el.parentNode !== capa) capa.appendChild(el);
    estilar(el, it, pv.viewport.scale);
  }
  for (const [id, el] of E.els) el.classList.toggle('sel', id === E.sel);
}
on('sincronizar', sincronizar);
// al cambiar el idioma se vuelven a escribir los títulos de los botones ya creados
on('idioma', () => {
  for (const b of document.querySelectorAll('.capa-fp [data-tk]')) { const x = t(b.dataset.tk); b.title = x; if (b.tagName === 'BUTTON') b.setAttribute('aria-label', x); }
});
on('programarSync', programarSync);

function estilar(el, it, k) {
  el.style.left = it.x * k + 'px'; el.style.top = it.y * k + 'px';
  const X = tipos[it.tipo];
  if (X) { el.style.width = Math.max(it.w, 1) * k + 'px'; el.style.height = Math.max(it.h, 1) * k + 'px'; X.estilar(el, it, k); return; }
  if (it.tipo === 'firma' || it.tipo === 'imagen') { el.style.width = it.w * k + 'px'; el.style.height = it.h * k + 'px'; }
  else {
    const t = el.querySelector('.t'); t.style.fontSize = it.size * k + 'px';
    if (t.textContent !== it.texto && document.activeElement !== t) t.textContent = it.texto;
  }
}
function boton(txt, cls, clave, fn) {
  const titulo = t(clave);
  const b = document.createElement('button'); if (ICONOS[txt]) b.innerHTML = svgIcono(txt, 22); else b.textContent = txt; if (cls) b.className = cls; b.title = titulo; b.setAttribute('aria-label', titulo); b.dataset.tk = clave;
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
}
function crearElemento(it) {
  const el = document.createElement('div'); el.className = 'it ' + it.tipo; el.dataset.id = it.id;
  const ctl = document.createElement('div'); ctl.className = 'ctl';
  if (tipos[it.tipo]) { // anotaciones: se mueven y se borran como los demás
    tipos[it.tipo].crear(it, el, ctl);
    ctl.appendChild(boton('tachito', 'x', 'elementos.borrar', () => borrar(it.id)));
    el.appendChild(ctl);
    el.addEventListener('pointerdown', (e) => {
      seleccionar(it.id);
      if (e.target.closest('.ctl') || e.target.closest('textarea, .nota-caja')) return;
      iniciarMovimiento(e, it, el, 'mover');
    });
    return el;
  }
  if (it.tipo === 'firma' || it.tipo === 'imagen') {
    const img = document.createElement('img'); img.src = it.png || it.src; img.draggable = false; el.appendChild(img);
    const rz = document.createElement('div'); rz.className = 'rz'; rz.title = t('elementos.cambiarTam'); rz.dataset.tk = 'elementos.cambiarTam'; el.appendChild(rz);
    rz.addEventListener('pointerdown', (e) => iniciarMovimiento(e, it, el, 'tam'));
  } else {
    const t = document.createElement('span'); t.className = 't'; t.contentEditable = 'plaintext-only'; t.spellcheck = false;
    t.textContent = it.texto; el.appendChild(t);
    const grip = boton('mover', 'grip', 'elementos.mover', () => {});
    grip.addEventListener('pointerdown', (e) => { e.stopPropagation(); iniciarMovimiento(e, it, el, 'mover'); });
    ctl.appendChild(grip);
    ctl.appendChild(boton('A−', '', 'elementos.letraMenor', () => cambiarTamano(it, -2)));
    ctl.appendChild(boton('A+', '', 'elementos.letraMayor', () => cambiarTamano(it, 2)));
    let tc = 0;
    t.addEventListener('input', () => { it.texto = t.textContent; clearTimeout(tc); tc = setTimeout(commit, 800); });
    t.addEventListener('blur', () => {
      clearTimeout(tc); it.texto = t.textContent;
      if (!it.texto.trim()) {
        E.items = E.items.filter((x) => x.id !== it.id);
        const estabaEnHist = !E.nuevos.has(it.id); E.nuevos.delete(it.id);
        if (E.sel === it.id) E.sel = null;
        sincronizar(); if (estabaEnHist) commit();
      } else { E.nuevos.delete(it.id); commit(); }
    });
    t.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '')); });
  }
  ctl.appendChild(boton('tachito', 'x', 'elementos.borrar', () => borrar(it.id)));
  el.appendChild(ctl);
  el.addEventListener('pointerdown', (e) => {
    seleccionar(it.id);
    if (e.target.closest('.ctl') || e.target.classList.contains('rz')) return;
    if (it.tipo === 'texto' && e.target.closest('.t')) return; // escribir
    iniciarMovimiento(e, it, el, 'mover');
  });
  return el;
}
export function seleccionar(id) {
  E.sel = id;
  for (const [i, el] of E.els) el.classList.toggle('sel', i === id);
  const it = E.items.find((x) => x.id === id), el = E.els.get(id);
  if (it && el) { const pv = vistaPagina(it.pagina); el.querySelector('.ctl').classList.toggle('abajo', it.y * (pv ? pv.viewport.scale : 1) < 64); }
}
document.addEventListener('pointerdown', (e) => {
  if (E.colocando) return;
  if (E.sel && !(e.target.closest && e.target.closest('.it'))) { E.sel = null; for (const el of E.els.values()) el.classList.remove('sel'); }
});
function iniciarMovimiento(e, it, el, modo) {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  const pv = vistaPagina(it.pagina); const k = pv.viewport.scale;
  const ini = { cx: e.clientX, cy: e.clientY, x: it.x, y: it.y, w: it.w, h: it.h, r: it.h / it.w };
  const vp = (E.paginas[it.pagina] || pv.pdfPage).getViewport({ scale: 1 });
  const cuerpo = e.currentTarget; let movido = false;
  try { cuerpo.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
  const mover = (ev) => {
    const dx = (ev.clientX - ini.cx) / k, dy = (ev.clientY - ini.cy) / k;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) movido = true;
    if (modo === 'mover') {
      const conTam = it.tipo === 'firma' || it.tipo === 'imagen' || tipos[it.tipo];
      const ancho = conTam ? it.w : 20, alto = conTam ? it.h : it.size;
      it.x = Math.min(vp.width - Math.min(20, ancho), Math.max(-ancho + 20, ini.x + dx));
      it.y = Math.min(vp.height - Math.min(20, alto), Math.max(-alto + 20, ini.y + dy));
    } else {
      it.w = Math.max(20, Math.min(vp.width * 1.5, ini.w + dx)); it.h = it.w * ini.r;
    }
    estilar(el, it, k);
  };
  const fin = () => {
    cuerpo.removeEventListener('pointermove', mover); cuerpo.removeEventListener('pointerup', fin); cuerpo.removeEventListener('pointercancel', fin);
    if (movido) commit();
  };
  cuerpo.addEventListener('pointermove', mover); cuerpo.addEventListener('pointerup', fin); cuerpo.addEventListener('pointercancel', fin);
}
function cambiarTamano(it, d) { it.size = Math.min(72, Math.max(6, it.size + d)); sincronizar(); commit(); }
export function borrar(id) {
  E.items = E.items.filter((x) => x.id !== id); E.nuevos.delete(id); if (E.sel === id) E.sel = null; sincronizar(); commit();
}

// ---------- colocar (firma / texto / fecha) ----------
export function iniciarColocar(modo, datos) {
  if (!E.pdf) return;
  cancelarColocar(true);
  E.colocando = { modo, ...datos };
  E.colocando.aviso = () => {
    if (modo === 'imagen') return datos.total > 1 ? t('elementos.clicImagenN', { i: datos.indice, n: datos.total }) : t('elementos.clicImagen');
    return t(modo === 'firma' ? 'elementos.clicFirma' : modo === 'fecha' ? 'elementos.clicFecha' : 'elementos.clicTexto');
  };
  document.body.classList.add('colocando'); renderAviso();
  const f = $('fantasma'); f.innerHTML = '';
  if (modo === 'firma') {
    const img = document.createElement('img'); img.src = datos.png; f.appendChild(img); f.style.width = ANCHO_FIRMA_PT * escalaPx() + 'px';
  } else if (modo === 'imagen') {
    const img = document.createElement('img'); img.src = datos.src; f.appendChild(img);
    f.style.width = Math.min(180, 260 / datos.ratio) * escalaPx() + 'px';
  } else {
    const tx = document.createElement('div'); tx.className = 't'; tx.style.fontSize = 14 * escalaPx() + 'px';
    tx.textContent = modo === 'fecha' ? fechaHoy() : t('elementos.texto'); f.style.width = 'auto'; f.appendChild(tx);
  }
}
export function cancelarColocar(silencioso) {
  if (!E.colocando) return;
  E.colocando = null; document.body.classList.remove('colocando'); $('fantasma').style.display = 'none'; renderAviso();
}
on('cancelarColocar', () => cancelarColocar());
document.addEventListener('pointermove', (e) => {
  if (!E.colocando) return;
  const f = $('fantasma');
  if (e.target.closest && e.target.closest('#visor')) { f.style.display = 'block'; f.style.left = e.clientX + 'px'; f.style.top = e.clientY + 'px'; }
  else f.style.display = 'none';
});
// en modo colocar, ni el clic ni el pulsar sobre el visor llegan a los campos del formulario (no se enfocan)
for (const ev of ['pointerdown', 'mousedown', 'touchstart']) {
  document.addEventListener(ev, (e) => {
    if (!E.colocando || !(e.target.closest && e.target.closest('#visor'))) return;
    e.preventDefault(); e.stopPropagation();
  }, { capture: true, passive: false });
}
document.addEventListener('click', (e) => {
  if (!E.colocando) return;
  const enVisor = e.target.closest && e.target.closest('#visor');
  if (!enVisor) { if (!e.target.closest('#aviso')) cancelarColocar(); return; }
  e.preventDefault(); e.stopPropagation();
  const pagina = e.target.closest('.page'); if (!pagina) return;
  const n = +pagina.dataset.pageNumber, pv = vistaPagina(n); if (!pv) return;
  const r = pagina.getBoundingClientRect(), k = pv.viewport.scale, f = r.width / pagina.offsetWidth;
  colocarEn(n, (e.clientX - r.left) / f / k, (e.clientY - r.top) / f / k);
}, true);

async function colocarEn(n, ux, uy) {
  const c = E.colocando; cancelarColocar();
  const pv = vistaPagina(n); if (pv && pv.pdfPage) E.paginas[n] = pv.pdfPage;
  let it;
  if (c.modo === 'firma') {
    const w = ANCHO_FIRMA_PT, h = w * c.ratio;
    it = { id: E.sigId++, tipo: 'firma', pagina: n, x: ux - w / 2, y: uy - h / 2, w, h, png: c.png };
  } else if (c.modo === 'imagen') {
    const vp = (E.paginas[n] || pv.pdfPage).getViewport({ scale: 1 });
    let w = Math.min(283.5, vp.width * 0.6), h = w * c.ratio; // ≈ 10 cm de ancho, sin pasar del 60 % de la página
    if (h > vp.height * 0.6) { h = vp.height * 0.6; w = h / c.ratio; }
    it = { id: E.sigId++, tipo: 'imagen', pagina: n, x: ux - w / 2, y: uy - h / 2, w, h, src: c.src };
  } else {
    const size = 14;
    it = { id: E.sigId++, tipo: 'texto', pagina: n, x: ux - 2, y: uy - size / 2, w: 0, h: size, size, texto: c.modo === 'fecha' ? fechaHoy() : '' };
    if (c.modo === 'texto') E.nuevos.add(it.id);
  }
  E.items.push(it); seleccionar(it.id); sincronizar();
  if (it.tipo === 'firma' || it.tipo === 'imagen' || c.modo === 'fecha') commit();
  if (c.modo === 'imagen' && c.cola && c.cola.length) { // varias fotos: la siguiente queda lista para colocar
    const [sig, ...resto] = c.cola;
    iniciarColocar('imagen', { src: sig.src, ratio: sig.ratio, cola: resto, indice: c.indice + 1, total: c.total });
  }
  if (c.modo === 'texto') { const t = E.els.get(it.id).querySelector('.t'); t.focus(); }
}
