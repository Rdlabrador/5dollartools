// Menú desplegable "Rellenar" (Texto, Fecha, Anotar) y selector de idioma. Solo abre y cierra el menú; cada opción conserva su botón y su función.
import { $ } from './util.js';
import { idioma, cambiarIdioma } from './i18n.js';
import { on } from './estado.js';

const boton = $('bRellenar'), menu = $('menuRellenar');
function abrirMenu(v) {
  menu.classList.toggle('hidden', !v);
  boton.setAttribute('aria-expanded', v ? 'true' : 'false');
  boton.classList.toggle('on', v);
  if (v) { const p = menu.querySelector('button'); if (p) p.focus(); }
}
boton.addEventListener('click', (e) => { e.stopPropagation(); abrirMenu(menu.classList.contains('hidden')); });
menu.addEventListener('click', () => abrirMenu(false)); // elegir una opción cierra el menú (la opción ya hizo lo suyo)
document.addEventListener('click', (e) => { if (!menu.classList.contains('hidden') && !e.target.closest('#cajaRellenar')) abrirMenu(false); });
document.addEventListener('keydown', (e) => {
  if (menu.classList.contains('hidden')) return;
  if (e.key === 'Escape') { e.stopPropagation(); abrirMenu(false); boton.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const b = [...menu.querySelectorAll('button')], i = b.indexOf(document.activeElement);
    b[(i + (e.key === 'ArrowDown' ? 1 : b.length - 1)) % b.length].focus();
  }
}, true);

// ---------- selector de idioma: botón con globo al final de la barra superior; alterna español / English ----------
const bIdioma = $('bIdioma');
const pintarIdioma = () => { $('idiomaTxt').textContent = idioma().toUpperCase(); };
bIdioma.addEventListener('click', () => cambiarIdioma(idioma() === 'es' ? 'en' : 'es'));
on('idioma', pintarIdioma);
pintarIdioma();
