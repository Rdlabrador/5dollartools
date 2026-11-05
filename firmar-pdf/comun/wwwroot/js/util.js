// Utilidades: avisos, pantalla de carga, ventanas y diálogos reutilizables.
import { E } from './estado.js';
import { agregar, t, fechaLocal } from './i18n.js';

agregar({
  es: {
    'util.cancelar': 'Cancelar', 'util.aceptar': 'Aceptar', 'util.cancelando': 'Cancelando…', 'util.momento': 'Un momento…',
    'util.simbolos': 'Algunos símbolos (como emojis) no se pueden guardar y se quitaron.',
    'util.imagenError': 'imagen',
    'util.rangoVacio': 'Escriba las páginas, por ejemplo 1-3, 5.',
    'util.rangoNoEntiende': '"{parte}" no se entiende. Escriba por ejemplo 1-3, 5.',
    'util.rangoAlReves': 'El rango {parte} está al revés. Escríbalo de menor a mayor.',
    'util.rangoNoExiste': 'La página {n} no existe: el documento tiene {total}.',
    'util.rangoEtiqueta': 'Páginas (de 1 a {total}). Ejemplo: 1-3, 5',
  },
  en: {
    'util.cancelar': 'Cancel', 'util.aceptar': 'OK', 'util.cancelando': 'Cancelling…', 'util.momento': 'One moment…',
    'util.simbolos': 'Some symbols (such as emojis) cannot be saved, so they were removed.',
    'util.imagenError': 'image',
    'util.rangoVacio': 'Type the pages, for example 1-3, 5.',
    'util.rangoNoEntiende': 'We could not understand "{parte}". Type something like 1-3, 5.',
    'util.rangoAlReves': 'The range {parte} is backwards. Write it from the lowest to the highest page.',
    'util.rangoNoExiste': 'Page {n} does not exist. The document has {total} pages.',
    'util.rangoEtiqueta': 'Pages (1 to {total}). Example: 1-3, 5',
  },
});

export const $ = (id) => document.getElementById(id);
// Un texto puede venir como cadena o como función que lo devuelve (así se traduce al cambiar el idioma): () => t('clave')
export const textoDe = (x) => (typeof x === 'function' ? x() : x);

let tToast = 0;
export function toast(txt, error = false, ms = 3500) {
  const el = $('toast'); el.textContent = txt; el.classList.toggle('error', !!error); el.classList.add('on');
  clearTimeout(tToast); tToast = setTimeout(() => el.classList.remove('on'), ms);
}
export function mostrarCarga(txt) { $('cargaTxt').textContent = txt || t('util.momento'); $('carga').classList.remove('hidden'); }
export function ocultarCarga() { $('carga').classList.add('hidden'); $('cargaBarra').classList.add('hidden'); ocultarCancelar(); }
function ocultarCancelar() { const b = $('cargaCancelar'); b.classList.add('hidden'); b.onclick = null; }
export const abrirModal = (id) => $(id).classList.remove('hidden');
export const cerrarModal = (id) => $(id).classList.add('hidden');
export const ocupado = () => !$('carga').classList.contains('hidden') || !!E.esperando;
export const msgSimbolos = () => t('util.simbolos');

// Progreso: texto en la pantalla de carga y, si se da una fracción (0 a 1), una barra.
// alCancelar (opcional): muestra el botón "Cancelar" y lo llama al tocarlo.
export function progreso(texto, fraccion, alCancelar) {
  mostrarCarga(texto);
  const bc = $('cargaCancelar');
  if (alCancelar) {
    if (bc.classList.contains('hidden')) { bc.disabled = false; bc.textContent = t('util.cancelar'); bc.classList.remove('hidden'); }
    bc.onclick = () => { bc.disabled = true; bc.textContent = t('util.cancelando'); alCancelar(); };
  }
  else ocultarCancelar();
  const barra = $('cargaBarra');
  if (typeof fraccion === 'number' && isFinite(fraccion)) {
    barra.classList.remove('hidden');
    $('cargaBarraRelleno').style.width = Math.round(Math.min(1, Math.max(0, fraccion)) * 100) + '%';
  } else barra.classList.add('hidden');
}
export function finProgreso() { ocultarCarga(); }

export function aBase64(u8) {
  const partes = []; const T = 0x8000;
  for (let i = 0; i < u8.length; i += T) partes.push(String.fromCharCode.apply(null, u8.subarray(i, i + T)));
  return btoa(partes.join(''));
}
export function deBase64(b64) {
  const s = atob(b64); const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
export function cargarImagen(src) {
  return new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error(t('util.imagenError'))); i.src = src; });
}
export const fechaHoy = () => fechaLocal(); // según el idioma: 03-11-2026 (es) · 11/03/2026 (en)
export function descargar(bytes, nombre, mime = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// casilla (opcional): {texto, marcada}; al cerrar, casilla.marcada queda con lo que dejó el usuario.
export function confirmar(titulo, msg, si = t('util.aceptar'), no = t('util.cancelar'), casilla = null, peligro = false) {
  return new Promise((ok) => {
    $('confSi').classList.toggle('peligro', !!peligro); // peligro: botón de confirmar en rojo
    $('confTitulo').textContent = titulo; $('confMsg').textContent = msg;
    $('confSi').textContent = si; $('confNo').textContent = no;
    const cb = $('confCasilla');
    $('confCasillaEt').classList.toggle('hidden', !casilla);
    if (casilla) { $('confCasillaTxt').textContent = casilla.texto; cb.checked = !!casilla.marcada; }
    const fin = (v) => { if (casilla) casilla.marcada = cb.checked; cerrarModal('dlgConfirm'); $('confSi').onclick = $('confNo').onclick = null; ok(v); };
    $('confSi').onclick = () => fin(true); $('confNo').onclick = () => fin(false);
    abrirModal('dlgConfirm'); $('confSi').focus();
  });
}

// elegir(titulo, [{valor, texto, descripcion}]) → Promise del valor elegido (null si cancela)
export function elegir(titulo, opciones) {
  return new Promise((ok) => {
    $('elegirTitulo').textContent = titulo;
    const lista = $('elegirLista'); lista.innerHTML = '';
    const fin = (v) => { cerrarModal('dlgElegir'); $('elegirCancelar').onclick = null; lista.innerHTML = ''; ok(v); };
    for (const o of opciones) {
      const b = document.createElement('button'); b.className = 'btn grande opcion sinic';
      b.appendChild(document.createTextNode(o.texto));
      if (o.descripcion) { const s = document.createElement('small'); s.textContent = o.descripcion; b.appendChild(s); }
      b.onclick = () => fin(o.valor);
      lista.appendChild(b);
    }
    $('elegirCancelar').onclick = () => fin(null);
    abrirModal('dlgElegir');
    const p = lista.querySelector('button'); if (p) p.focus();
  });
}

// pedirTexto(titulo, etiqueta, valorInicial, {tipo:'password'|'text'|'number', validar(valor)→mensaje|null, ok}) → texto (null si cancela)
export function pedirTexto(titulo, etiqueta, valorInicial = '', opt = {}) {
  return new Promise((ok) => {
    const inp = $('textoInput'), err = $('textoError');
    $('textoTitulo').textContent = titulo; $('textoEtiqueta').textContent = etiqueta || '';
    $('textoEtiqueta').classList.toggle('hidden', !etiqueta);
    inp.type = opt.tipo || 'text'; inp.value = valorInicial == null ? '' : String(valorInicial);
    err.classList.add('hidden'); $('textoOk').textContent = opt.ok || t('util.aceptar');
    // al cerrar se vacía el campo: una contraseña no debe quedar en el DOM
    const fin = (v) => { cerrarModal('dlgTexto'); inp.value = ''; inp.type = 'text'; $('textoOk').onclick = $('textoCancelar').onclick = inp.onkeydown = inp.oninput = null; ok(v); };
    const aceptar = () => {
      const v = inp.value;
      const msg = opt.validar ? opt.validar(v) : null;
      if (msg) { err.textContent = msg; err.classList.remove('hidden'); inp.focus(); return; }
      fin(v);
    };
    $('textoOk').onclick = aceptar; $('textoCancelar').onclick = () => fin(null);
    inp.onkeydown = (e) => { if (e.key === 'Enter') aceptar(); };
    inp.oninput = () => err.classList.add('hidden');
    abrirModal('dlgTexto'); inp.focus(); inp.select();
  });
}

// "1-3, 5" → {paginas:[1,2,3,5]} o {error:'mensaje'}. Sin repetidas; conserva el orden escrito.
export function analizarRango(texto, total) {
  const txt = String(texto || '').replace(/\s*-\s*/g, '-').trim();
  if (!txt) return { error: t('util.rangoVacio') };
  const res = [], vistos = new Set();
  for (const parte of txt.split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(parte);
    if (!m) return { error: t('util.rangoNoEntiende', { parte }) };
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a > b) return { error: t('util.rangoAlReves', { parte }) };
    for (const n of [a, b]) if (n < 1 || n > total) return { error: t('util.rangoNoExiste', { n, total }) };
    for (let n = a; n <= b; n++) if (!vistos.has(n)) { vistos.add(n); res.push(n); }
  }
  return { paginas: res };
}
export async function pedirRangoPaginas(titulo, total) {
  const r = await pedirTexto(titulo, t('util.rangoEtiqueta', { total }), '', {
    validar: (v) => analizarRango(v, total).error || null,
  });
  return r === null ? null : analizarRango(r, total).paginas;
}

// botones "Cancelar" de las ventanas simples
document.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => b.closest('.modal').classList.add('hidden')));
