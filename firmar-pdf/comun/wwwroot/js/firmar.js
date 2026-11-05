// Firma: guardada, con el mouse y con el celular.
import { E, on, MAX_FIRMAS } from './estado.js';
import { $, toast, abrirModal, cerrarModal, cargarImagen, confirmar, pedirTexto, ocupado } from './util.js';
import { icono } from './iconos.js';
import { leerFirmas, agregarFirma, renombrarFirma, marcarUsada, eliminarFirma, recomendada, hayEspacio } from './firmas.js';
import { post, puente, alMensaje } from './puente.js';
import { iniciarColocar } from './elementos.js';
import { agregar, t, traducirDOM } from './i18n.js';

agregar({
  es: {
    'firmar.imagenError': 'imagen',
    'firmar.noLlego': 'La firma no llegó bien. Inténtelo de nuevo.',
    'firmar.primeroAbra': 'Primero abra un PDF.',
    'firmar.dibujePrimero': 'Dibuje primero su firma.',
    'firmar.soloWindows': 'Firmar con el celular solo funciona en el programa de Windows.',
    'firmar.preparando': 'Preparando el código…',
    'firmar.vencio': 'El código venció',
    'firmar.crearNuevo': 'Crear código nuevo',
    'firmar.sinConexion': 'No se pudo preparar la conexión con el celular.',
    'firmar.usar': 'Usar', 'firmar.usarTit': 'Usar la firma «{nombre}»',
    'firmar.eliminarTit': 'Eliminar la firma «{nombre}»',
    'firmar.renombrarTit': 'Cambiar el nombre de «{nombre}»',
    'firmar.nombreTitulo': 'Nombre de la firma', 'firmar.nombreEtiqueta': 'Escriba un nombre corto, por ejemplo: Mi firma, Iniciales',
    'firmar.confirmarTitulo': '¿Eliminar esta firma?',
    'firmar.confirmarMsg': '¿Eliminar la firma «{nombre}»? No se puede deshacer.',
    'firmar.siEliminar': 'Sí, eliminar', 'firmar.noEliminar': 'No, conservarla',
    'firmar.eliminada': 'Firma eliminada.',
    'firmar.guardarTitulo': 'Guardar esta firma para la próxima vez', 'firmar.nuevaAlt': 'Firma nueva',
    'firmar.nombreEt': 'Nombre (opcional)', 'firmar.nombreEjemplos': 'Ejemplos: Mi firma, Iniciales',
    'firmar.llenas': 'Ya tiene {max} firmas guardadas. Para guardar esta, primero elimine una de la lista.',
    'firmar.soloUsar': 'Solo usarla ahora', 'firmar.guardarYUsar': 'Guardar y usar',
    'firmar.guardada': 'Firma guardada.', 'firmar.recomendado': 'Recomendado',
    'firmar.conectado': 'Celular conectado', 'firmar.subFirma': 'Firme en el celular y toque Enviar',
    'firmar.subFoto': 'Elija sus fotos en el celular y toque Enviar',
    'firmar.firmaRecibida': '¡Firma recibida!', 'firmar.fotosRecibidas.1': '¡1 foto recibida!', 'firmar.fotosRecibidas.n': '¡{n} fotos recibidas!',
    'firmar.firmaAlt': 'Firma recibida', 'firmar.fotoAlt': 'Foto {n}',
    'firmar.fondoFirma': 'Cuando firme en el celular, la firma aparecerá aquí sola.',
    'firmar.fondoFoto': 'Cuando elija las fotos en el celular, aparecerán aquí solas.',
    'firmar.venciFondo': 'El código del celular venció. Si todavía lo necesita, cree uno nuevo.',
  },
  en: {
    'firmar.imagenError': 'image',
    'firmar.noLlego': 'Your signature did not come through. Please try again.',
    'firmar.primeroAbra': 'Open a PDF first.',
    'firmar.dibujePrimero': 'Draw your signature first.',
    'firmar.soloWindows': 'Signing with your phone only works in the Windows program.',
    'firmar.preparando': 'Getting the code ready…',
    'firmar.vencio': 'The code has expired',
    'firmar.crearNuevo': 'Create a new code',
    'firmar.sinConexion': 'The connection with your phone could not be set up.',
    'firmar.usar': 'Use', 'firmar.usarTit': 'Use the signature "{nombre}"',
    'firmar.eliminarTit': 'Delete the signature "{nombre}"',
    'firmar.renombrarTit': 'Change the name of "{nombre}"',
    'firmar.nombreTitulo': 'Signature name', 'firmar.nombreEtiqueta': 'Type a short name, for example: My signature, Initials',
    'firmar.confirmarTitulo': 'Delete this signature?',
    'firmar.confirmarMsg': 'Delete the signature "{nombre}"? This cannot be undone.',
    'firmar.siEliminar': 'Yes, delete it', 'firmar.noEliminar': 'No, keep it',
    'firmar.eliminada': 'Signature deleted.',
    'firmar.guardarTitulo': 'Save this signature for next time', 'firmar.nuevaAlt': 'New signature',
    'firmar.nombreEt': 'Name (optional)', 'firmar.nombreEjemplos': 'Examples: My signature, Initials',
    'firmar.llenas': 'You already have {max} saved signatures. To save this one, first delete one from the list.',
    'firmar.soloUsar': 'Just use it now', 'firmar.guardarYUsar': 'Save and use',
    'firmar.guardada': 'Signature saved.', 'firmar.recomendado': 'Recommended',
    'firmar.conectado': 'Phone connected', 'firmar.subFirma': 'Sign on your phone and tap Send',
    'firmar.subFoto': 'Choose your photos on your phone and tap Send',
    'firmar.firmaRecibida': 'Signature received!', 'firmar.fotosRecibidas.1': '1 photo received!', 'firmar.fotosRecibidas.n': '{n} photos received!',
    'firmar.firmaAlt': 'Signature received', 'firmar.fotoAlt': 'Photo {n}',
    'firmar.fondoFirma': 'When you sign on your phone, the signature will appear here by itself.',
    'firmar.fondoFoto': 'When you choose the photos on your phone, they will appear here by themselves.',
    'firmar.venciFondo': 'The phone code has expired. If you still need it, create a new one.',
  },
});

// Las firmas guardadas viven en firmas.js. usarFirma(png) solo la coloca; guardar es una decision aparte (ofrecerGuardar).
export async function usarFirma(png) {
  try {
    const img = await cargarImagen(png);
    if (!img.naturalWidth || !img.naturalHeight) throw new Error(t('firmar.imagenError'));
    document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
    iniciarColocar('firma', { png, ratio: img.naturalHeight / img.naturalWidth });
  } catch (e) {
    console.error(e);
    toast(t('firmar.noLlego'), true, 5000);
  }
}
// ---- lista de firmas guardadas dentro de "¿Cómo quiere firmar?" ----
function boton(clase, ic, tit, fn) {
  const b = document.createElement('button'); b.className = clase; b.type = 'button'; b.title = tit; b.setAttribute('aria-label', tit);
  b.innerHTML = icono(ic, 24); b.onclick = (e) => { e.stopPropagation(); fn(); };
  return b;
}
function pintarFirmas() {
  const cont = $('listaFirmas'); cont.innerHTML = '';
  const lista = leerFirmas(), rec = recomendada(lista);
  for (const f of lista) {
    const esRec = !!rec && rec.id === f.id;
    const tar = document.createElement('div'); tar.className = 'firma-tarjeta' + (esRec ? ' rec-on' : '');
    tar.dataset.id = f.id; tar.title = t('firmar.usarTit', { nombre: f.nombre });
    if (esRec) { const r = document.createElement('span'); r.className = 'rec'; r.textContent = t('firmar.recomendado'); tar.appendChild(r); }
    const img = document.createElement('div'); img.className = 'img';
    const im = document.createElement('img'); im.src = f.png; im.alt = f.nombre; img.appendChild(im);
    const datos = document.createElement('div'); datos.className = 'datos';
    const nom = document.createElement('div'); nom.className = 'nom';
    const sp = document.createElement('span'); sp.textContent = f.nombre; sp.title = f.nombre; nom.appendChild(sp);
    nom.appendChild(boton('btn icono ren', 'dibujar', t('firmar.renombrarTit', { nombre: f.nombre }), () => renombrar(f)));
    const acc = document.createElement('div'); acc.className = 'acc';
    const bu = document.createElement('button'); bu.className = 'btn primary usar'; bu.type = 'button'; bu.textContent = t('firmar.usar');
    bu.title = t('firmar.usarTit', { nombre: f.nombre }); bu.onclick = (e) => { e.stopPropagation(); usarGuardada(f.id); };
    const be = boton('btn icono peligro eliminar', 'tachito', t('firmar.eliminarTit', { nombre: f.nombre }), () => eliminar(f));
    acc.append(bu, be); datos.append(nom, acc);
    tar.append(img, datos); tar.onclick = () => usarGuardada(f.id);
    cont.appendChild(tar);
  }
}
function usarGuardada(id) {
  const f = leerFirmas().find((x) => x.id === id); if (!f) return;
  marcarUsada(id); usarFirma(f.png);
}
async function renombrar(f) {
  const n = await pedirTexto(t('firmar.nombreTitulo'), t('firmar.nombreEtiqueta'), f.nombre, { validar: (v) => (v.trim() ? null : t('firmar.nombreEtiqueta')) });
  if (n === null) return;
  if (!renombrarFirma(f.id, n)) toast(t('firmar.sinEspacio'), true, 6000);
  pintarFirmas();
}
async function eliminar(f) {
  const si = await confirmar(t('firmar.confirmarTitulo'), t('firmar.confirmarMsg', { nombre: f.nombre }), t('firmar.siEliminar'), t('firmar.noEliminar'), null, true);
  if (!si) return;
  if (!eliminarFirma(f.id)) { toast(t('firmar.sinEspacio'), true, 6000); return; }
  pintarFirmas(); toast(t('firmar.eliminada'));
}
on('idioma', () => { if (!$('dlgFirma').classList.contains('hidden')) pintarFirmas(); });

$('bFirmar').onclick = () => {
  if (!E.pdf) { toast(t('firmar.primeroAbra')); return; }
  pintarFirmas();
  abrirModal('dlgFirma');
};

// ---- ofrecer guardar una firma nueva (mouse o celular) antes de colocarla ----
function ofrecerGuardar(png) {
  const lleno = !hayEspacio();
  $('gfImg').src = png; $('gfNombre').value = '';
  $('gfNombre').classList.toggle('hidden', lleno); $('gfEtiqueta').classList.toggle('hidden', lleno);
  $('gfLleno').classList.toggle('hidden', !lleno); $('gfLleno').textContent = t('firmar.llenas', { max: MAX_FIRMAS });
  $('gfGuardar').classList.toggle('hidden', lleno);
  const fin = (guardar) => {
    cerrarModal('dlgGuardarFirma'); $('gfSolo').onclick = $('gfGuardar').onclick = $('gfNombre').onkeydown = null;
    if (guardar) {
      const f = agregarFirma(png, $('gfNombre').value);
      if (f) { marcarUsada(f.id); toast(t('firmar.guardada')); } else toast(t('firmar.sinEspacio'), true, 6000);
    }
    usarFirma(png);
  };
  $('gfSolo').onclick = () => fin(false); $('gfGuardar').onclick = () => fin(true);
  $('gfNombre').onkeydown = (e) => { if (e.key === 'Enter') fin(true); };
  abrirModal('dlgGuardarFirma');
  if (lleno) $('gfSolo').focus(); else $('gfNombre').focus();
}
$('bTexto').onclick = () => iniciarColocar('texto', {});
$('bFecha').onclick = () => iniciarColocar('fecha', {});

// con el mouse
const lienzo = $('lienzo'), ctx = lienzo.getContext('2d');
let trazos = [], trazoActual = null, colorFirma = '#111111';
function dibujarTrazos() {
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  const dpr = lienzo.width / lienzo.clientWidth;
  ctx.strokeStyle = colorFirma; ctx.fillStyle = colorFirma; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.2 * dpr;
  for (const t of trazos) {
    if (t.length === 1) { ctx.beginPath(); ctx.arc(t[0].x, t[0].y, 1.6 * dpr, 0, 7); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(t[0].x, t[0].y);
    for (let i = 1; i < t.length - 1; i++) ctx.quadraticCurveTo(t[i].x, t[i].y, (t[i].x + t[i + 1].x) / 2, (t[i].y + t[i + 1].y) / 2);
    ctx.lineTo(t[t.length - 1].x, t[t.length - 1].y); ctx.stroke();
  }
  $('lienzoCaja').classList.toggle('tiene', trazos.length > 0);
}
function abrirMouse() {
  cerrarModal('dlgFirma'); abrirModal('dlgMouse');
  const dpr = Math.max(1, Math.min(3, devicePixelRatio || 1));
  lienzo.width = lienzo.clientWidth * dpr; lienzo.height = lienzo.clientHeight * dpr;
  trazos = []; trazoActual = null; dibujarTrazos();
}
$('fMouse').onclick = abrirMouse;
const puntoLienzo = (e) => { const r = lienzo.getBoundingClientRect(); const s = lienzo.width / r.width; return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
lienzo.addEventListener('pointerdown', (e) => {
  e.preventDefault(); lienzo.setPointerCapture(e.pointerId);
  trazoActual = [puntoLienzo(e)]; trazos.push(trazoActual); dibujarTrazos();
});
lienzo.addEventListener('pointermove', (e) => { if (!trazoActual) return; trazoActual.push(puntoLienzo(e)); dibujarTrazos(); });
const finTrazo = () => { trazoActual = null; };
lienzo.addEventListener('pointerup', finTrazo); lienzo.addEventListener('pointercancel', finTrazo);
$('mBorrar').onclick = () => { trazos = []; dibujarTrazos(); };
document.querySelectorAll('.btn.color').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.btn.color').forEach((x) => x.classList.toggle('on', x === b)); colorFirma = b.dataset.color; dibujarTrazos();
}));
$('mListo').onclick = () => {
  if (!trazos.length) { toast(t('firmar.dibujePrimero'), true); return; }
  const dpr = lienzo.width / lienzo.clientWidth, m = 6 * dpr;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const t of trazos) for (const p of t) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  x0 = Math.max(0, Math.floor(x0 - m)); y0 = Math.max(0, Math.floor(y0 - m));
  x1 = Math.min(lienzo.width, Math.ceil(x1 + m)); y1 = Math.min(lienzo.height, Math.ceil(y1 + m));
  const w = x1 - x0, h = y1 - y0, esc = Math.min(1, 1200 / w);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * esc)); c.height = Math.max(1, Math.round(h * esc));
  c.getContext('2d').drawImage(lienzo, x0, y0, w, h, 0, 0, c.width, c.height);
  cerrarModal('dlgMouse'); ofrecerGuardar(c.toDataURL('image/png'));
};

// con el celular
// modo 'firma' (por defecto) o 'foto': el mismo diálogo del código QR sirve para los dos; el modo viaja en movilIniciar
let modoMovil = 'firma';
let fasePasos = 'qr', temporizadorAyuda = null; // 'qr' | 'conectado' | 'recibido'
let enFondo = false; // true: el usuario tocó "Aceptar"; el servidor sigue y lo que llegue se carga solo
let pendientes = [], vigilante = null;
// Lo que llega con el diálogo cerrado espera a que no haya otro modal, ni carga, ni un elemento por colocar.
const libre = () => !document.querySelector('.modal:not(.hidden)') && !ocupado() && !E.colocando;
function entregar(fn) {
  pendientes.push(fn);
  if (vigilante) return;
  vigilante = setInterval(() => {
    if (!pendientes.length) { clearInterval(vigilante); vigilante = null; return; }
    if (!libre()) return;
    const f = pendientes.shift();
    try { f(); } catch (e) { console.error(e); }
  }, 400);
}
const movilAbierto = () => !$('dlgMovil').classList.contains('hidden');
function verEsperando() { // vuelve al paso 1 (el código QR)
  clearTimeout(temporizadorAyuda); temporizadorAyuda = null; fasePasos = 'qr';
  $('movilEsperando').classList.remove('hidden'); $('movilEstado').classList.add('hidden');
  $('movilListo').classList.add('hidden'); $('movilListo').onclick = null; $('movilAyuda').classList.add('hidden');
  $('movilAceptar').classList.remove('hidden'); $('movilCancelarBtn').classList.remove('hidden');
}
function iniciarAyuda() {
  clearTimeout(temporizadorAyuda);
  const ms = (window.__fp && window.__fp.movilAyudaMs) || 45000;
  temporizadorAyuda = setTimeout(() => { if (fasePasos === 'qr' && movilAbierto()) $('movilAyuda').classList.remove('hidden'); }, ms);
}
function cerrarMovil() { clearTimeout(temporizadorAyuda); temporizadorAyuda = null; cerrarModal('dlgMovil'); }
// Paso 3: llegó lo que se pidió. Muestra la vista previa y el flujo sigue solo cuando se toca "Listo".
export function movilRecibido({ titulo, vista, clase, alListo }) {
  if (!movilAbierto()) {
    if (!enFondo) return false;
    enFondo = false; toast(titulo); entregar(alListo); return true; // llegó con el diálogo cerrado: se carga igual
  }
  clearTimeout(temporizadorAyuda); fasePasos = 'recibido';
  $('movilAceptar').classList.add('hidden');
  $('movilEsperando').classList.add('hidden'); $('movilEstado').classList.remove('hidden');
  $('movilEstadoTitulo').textContent = titulo; $('movilEstadoSub').textContent = ''; $('movilPuntos').classList.add('hidden');
  const v = $('movilVista'); v.innerHTML = ''; v.className = 'movil-vista ' + clase; v.append(...vista);
  const b = $('movilListo'); b.classList.remove('hidden');
  b.onclick = () => { b.onclick = null; cerrarMovil(); alListo(); };
  b.focus();
  return true;
}
export function abrirMovil(modo = 'firma') {
  modoMovil = modo === 'foto' ? 'foto' : 'firma';
  $('movilTitulo').dataset.i18n = modoMovil === 'foto' ? 'index.fotoCelularTitulo' : 'index.firmarCelular';
  $('movilPaso3').dataset.i18n = modoMovil === 'foto' ? 'index.paso3Foto' : 'index.paso3';
  traducirDOM($('dlgMovil'));
  enFondo = false; verEsperando(); iniciarAyuda(); // un QR nuevo reemplaza a la sesión de fondo
  cerrarModal('dlgFirma'); $('qrImg').classList.add('hidden'); $('qrEspera').classList.remove('hidden'); $('qrEspera').textContent = t('firmar.preparando');
  abrirModal('dlgMovil'); post(modoMovil === 'foto' ? { tipo: 'movilIniciar', modo: 'foto' } : { tipo: 'movilIniciar' });
}
$('fMovil').onclick = () => {
  if (!puente) { toast(t('firmar.soloWindows'), true, 5000); return; }
  abrirMovil('firma');
};
$('movilCancelarBtn').onclick = () => { enFondo = false; post({ tipo: 'movilCancelar' }); cerrarMovil(); };
$('movilAceptar').onclick = () => { // cierra el diálogo sin apagar el servidor
  if (fasePasos === 'recibido') return;
  enFondo = true; cerrarMovil(); toast(t(modoMovil === 'foto' ? 'firmar.fondoFoto' : 'firmar.fondoFirma'), false, 6000);
};
addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && movilAbierto() && fasePasos === 'recibido' && !e.repeat) { e.preventDefault(); $('movilListo').click(); }
});

alMensaje('movilConectado', () => {
  if (!movilAbierto() || fasePasos !== 'qr') return;
  clearTimeout(temporizadorAyuda); fasePasos = 'conectado';
  $('movilEsperando').classList.add('hidden'); $('movilEstado').classList.remove('hidden');
  $('movilEstadoTitulo').textContent = t('firmar.conectado');
  $('movilEstadoSub').textContent = t(modoMovil === 'foto' ? 'firmar.subFoto' : 'firmar.subFirma');
  $('movilPuntos').classList.remove('hidden'); $('movilVista').classList.add('hidden');
});
alMensaje('firmaMovil', (m) => {
  const img = document.createElement('img'); img.src = m.png; img.alt = t('firmar.firmaAlt');
  movilRecibido({ titulo: t('firmar.firmaRecibida'), vista: [img], clase: 'firma', alListo: () => ofrecerGuardar(m.png) });
});
alMensaje('movilQR', (m) => { $('qrImg').src = m.qr; $('qrImg').classList.remove('hidden'); $('qrEspera').classList.add('hidden'); });
alMensaje('movilVencido', () => {
  if (!movilAbierto()) { if (enFondo) { enFondo = false; toast(t('firmar.venciFondo'), false, 6000); } return; }
  verEsperando();
  $('qrImg').classList.add('hidden');
  const q = $('qrEspera'); q.classList.remove('hidden'); q.textContent = t('firmar.vencio');
  const b = document.createElement('button'); b.className = 'btn primary grande'; b.textContent = t('firmar.crearNuevo');
  b.style.marginTop = '16px';
  b.onclick = () => { q.textContent = t('firmar.preparando'); iniciarAyuda(); post(modoMovil === 'foto' ? { tipo: 'movilIniciar', modo: 'foto' } : { tipo: 'movilIniciar' }); };
  q.appendChild(document.createElement('br')); q.appendChild(b);
});
alMensaje('movilError', (m) => { enFondo = false; cerrarMovil(); toast(m.mensaje || t('firmar.sinConexion'), true, 7000); });
