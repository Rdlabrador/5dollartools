// Fase 2 "Buscar": barra de búsqueda (Ctrl+F) sobre PDFFindController de pdf.js. Sin distinguir mayúsculas ni tildes.
import { E, on } from './estado.js';
import { $, toast } from './util.js';
import { eventBus, findController } from './visor.js';
import { agregar, t } from './i18n.js';

agregar({
  es: { 'buscar.buscando': 'Buscando…', 'buscar.sinResultados': 'Sin resultados', 'buscar.cuenta': '{a} de {total}', 'buscar.abraPrimero': 'Abra un PDF primero.' },
  en: { 'buscar.buscando': 'Searching…', 'buscar.sinResultados': 'No results', 'buscar.cuenta': '{a} of {total}', 'buscar.abraPrimero': 'Open a PDF first.' },
});

const barra = $('barraBuscar'), campo = $('buscarInput'), cuenta = $('buscarCuenta');
let total = 0, actual = 0, estado = null, ultimaConsulta = '';

function pintar() {
  const q = campo.value.trim();
  if (!q) cuenta.textContent = ' ';
  else if (estado === 3) cuenta.textContent = t('buscar.buscando'); // PENDING
  else if (!total) cuenta.textContent = t('buscar.sinResultados');
  else cuenta.textContent = t('buscar.cuenta', { a: actual || 1, total });
}
function enviar(tipo, previo) {
  const query = campo.value;
  ultimaConsulta = query;
  eventBus.dispatch('find', {
    source: 'firmarpdf', type: tipo, query, caseSensitive: false, entireWord: false,
    highlightAll: true, findPrevious: !!previo, matchDiacritics: false,
  });
}
eventBus.on('updatefindmatchescount', (e) => { total = e.matchesCount.total; actual = e.matchesCount.current; pintar(); });
eventBus.on('updatefindcontrolstate', (e) => {
  estado = e.state; if (e.matchesCount) { total = e.matchesCount.total; actual = e.matchesCount.current; }
  campo.classList.toggle('sin-resultado', e.state === 1); pintar();
});

export function abrirBuscar(ver) {
  const v = ver === undefined ? barra.classList.contains('hidden') : !!ver;
  if (v && !E.pdf) { toast(t('buscar.abraPrimero'), true); return; }
  barra.classList.toggle('hidden', !v); $('bBuscar').classList.toggle('on', v);
  if (v) { campo.focus(); campo.select(); if (campo.value.trim()) enviar(''); }
  else { eventBus.dispatch('findbarclose', { source: 'firmarpdf' }); total = 0; actual = 0; estado = null; pintar(); }
}
$('bBuscar').onclick = () => abrirBuscar();
$('bBuscarCerrar').onclick = () => abrirBuscar(false);
$('bBuscarSig').onclick = () => siguiente(false);
$('bBuscarAnt').onclick = () => siguiente(true);
function siguiente(atras) {
  if (!campo.value.trim()) { campo.focus(); return; }
  enviar(campo.value === ultimaConsulta && estado !== null ? 'again' : '', atras);
}
let tBuscar = 0;
campo.addEventListener('input', () => {
  clearTimeout(tBuscar);
  if (!campo.value.trim()) { enviar(''); eventBus.dispatch('findbarclose', { source: 'firmarpdf' }); total = 0; actual = 0; estado = null; pintar(); return; }
  tBuscar = setTimeout(() => enviar(''), 250);
});
campo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(tBuscar); if (campo.value !== ultimaConsulta) enviar('', e.shiftKey); else siguiente(e.shiftKey); }
});
addEventListener('keydown', (e) => {
  const k = (e.key || '').toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 'f') {
    if (document.querySelector('.modal:not(.hidden)')) return;
    e.preventDefault(); abrirBuscar(true);
  } else if (k === 'escape' && !barra.classList.contains('hidden')) {
    if (document.querySelector('.modal:not(.hidden)') || E.colocando) return;
    const a = document.activeElement;
    if (a && a !== campo && (a.tagName === 'TEXTAREA' || a.isContentEditable)) return; // lo atiende quien edita
    // con la barra de anotar abierta y el foco fuera del campo, el Esc es de anotar (una sola cosa por Esc)
    if (a !== campo && !$('barraAnotar').classList.contains('hidden')) return;
    e.stopImmediatePropagation(); abrirBuscar(false);
  }
}, true);
// al cambiar de documento (p. ej. tras girar páginas) se repite la búsqueda abierta
on('idioma', pintar);
on('documentoCargado', () => { total = 0; actual = 0; estado = null; if (!barra.classList.contains('hidden') && campo.value.trim()) setTimeout(() => enviar(''), 200); else pintar(); });

// Para las pruebas: busca y devuelve {total} cuando termina de contar
export function buscar(texto) {
  return new Promise((ok) => {
    abrirBuscar(true); campo.value = texto; clearTimeout(tBuscar);
    let t = 0, fin = false;
    const cerrar = () => { if (fin) return; fin = true; off1(); off2(); clearTimeout(tope); ok({ total, actual }); };
    const reiniciar = () => { clearTimeout(t); t = setTimeout(cerrar, 500); };
    const f = () => { if (estado !== 3) reiniciar(); };
    eventBus.on('updatefindmatchescount', f); eventBus.on('updatefindcontrolstate', f);
    const off1 = () => eventBus.off('updatefindmatchescount', f), off2 = () => eventBus.off('updatefindcontrolstate', f);
    const tope = setTimeout(cerrar, 8000);
    estado = null; enviar('');
  });
}
export const textoCuenta = () => cuenta.textContent;
