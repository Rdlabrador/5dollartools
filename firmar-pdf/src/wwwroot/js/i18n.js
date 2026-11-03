// Idioma de la interfaz (es / en). Cada módulo registra sus textos con agregar({es:{...}, en:{...}})
// y los usa con t('clave', {variables}). Claves con prefijo del módulo: 'paginas.unir', 'util.cancelar'…
// Este archivo solo importa estado.js, para que cualquier módulo pueda importarlo sin ciclos.
import { emit } from './estado.js';

const IDIOMAS = ['es', 'en'];
const dic = { es: {}, en: {} };

function inicial() {
  const q = new URLSearchParams(location.search).get('idioma');   // lo pone el programa de Windows
  if (IDIOMAS.includes(q)) return q;
  return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en';  // modo prueba en Chrome
}
let actual = inicial();
document.documentElement.lang = actual;

export const idioma = () => actual;

export function agregar(textos) {
  for (const l of IDIOMAS) Object.assign(dic[l], textos[l] || {});
}

// t('paginas.borradas', {n: 3}) → reemplaza {n}. Si falta en el idioma, usa el español; si falta del todo, la clave.
export function t(clave, vars) {
  let s = dic[actual][clave] ?? dic.es[clave];
  if (s === undefined) { console.warn('[i18n] falta', clave); return clave; }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
  return s;
}

// Plural: usa 'clave.1' si n === 1 y 'clave.n' en otro caso; {n} queda disponible.
export function tn(clave, n, vars) {
  return t(clave + (n === 1 ? '.1' : '.n'), { n, ...vars });
}

// HTML fijo: data-i18n (texto; ponerlo en un <span> solo con el texto, para no borrar íconos),
// data-i18n-title, data-i18n-placeholder, data-i18n-alt, data-i18n-aria (aria-label).
export function traducirDOM(raiz = document) {
  for (const el of raiz.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of raiz.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of raiz.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of raiz.querySelectorAll('[data-i18n-alt]')) el.alt = t(el.dataset.i18nAlt);
  for (const el of raiz.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}

// Cambia el idioma sin recargar: avisa al programa, traduce el HTML fijo y emite 'idioma'
// (los módulos que dejan texto generado en pantalla escuchan on('idioma', ...) y lo vuelven a pintar).
export function cambiarIdioma(l) {
  if (!IDIOMAS.includes(l) || l === actual) return;
  actual = l;
  document.documentElement.lang = l;
  const wv = window.chrome && window.chrome.webview;
  if (wv) wv.postMessage({ tipo: 'idioma', idioma: l });
  traducirDOM();
  emit('idioma', l);
}

// Fecha de hoy en el formato del idioma: es → 03-11-2026 · en → 11/03/2026
export function fechaLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return actual === 'en'
    ? `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`
    : `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}
