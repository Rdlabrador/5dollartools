// Atajos de teclado.
import { E } from './estado.js';
import { $ } from './util.js';
import { zoom } from './visor.js';
import { cancelarColocar, borrar } from './elementos.js';
import { deshacer, rehacer } from './historial.js';
import { abrir } from './documento.js';
import { imprimir } from './guardar.js';

const escribiendo = () => { const a = document.activeElement; return a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (E.colocando) { cancelarColocar(); return; }
    const abiertos = [...document.querySelectorAll('.modal:not(.hidden)')];
    const m = abiertos[abiertos.length - 1];
    if (m) { const c = m.querySelector('.cancelar'); if (c) c.click(); else m.classList.add('hidden'); }
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 'o') { e.preventDefault(); abrir(); }
    else if (k === 's') { e.preventDefault(); $('bGuardar').click(); }
    else if (k === 'p') { e.preventDefault(); imprimir(); }
    else if ((k === 'z' || k === 'y') && !escribiendo() && E.pdf) { e.preventDefault(); (k === 'y' || e.shiftKey) ? rehacer() : deshacer(); }
    else if (k === '+' || k === '=') { e.preventDefault(); zoom(1); }
    else if (k === '-') { e.preventDefault(); zoom(-1); }
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && E.sel && !escribiendo()) { e.preventDefault(); borrar(E.sel); }
});
