// Firma: guardada, con el mouse y con el celular.
import { E, CLAVE_FIRMA } from './estado.js';
import { $, toast, abrirModal, cerrarModal, cargarImagen } from './util.js';
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
  },
});

const leerFirmaGuardada = () => { try { return localStorage.getItem(CLAVE_FIRMA); } catch (_) { return null; } };
export async function usarFirma(png) {
  try {
    const img = await cargarImagen(png);
    if (!img.naturalWidth || !img.naturalHeight) throw new Error(t('firmar.imagenError'));
    try { localStorage.setItem(CLAVE_FIRMA, png); } catch (_) { /* sin espacio */ }
    document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
    iniciarColocar('firma', { png, ratio: img.naturalHeight / img.naturalWidth });
  } catch (e) {
    console.error(e);
    toast(t('firmar.noLlego'), true, 5000);
  }
}
$('bFirmar').onclick = () => {
  if (!E.pdf) { toast(t('firmar.primeroAbra')); return; }
  const g = leerFirmaGuardada();
  $('fGuardada').classList.toggle('hidden', !g); if (g) $('fGuardadaImg').src = g;
  abrirModal('dlgFirma');
};
$('fGuardada').onclick = () => { const g = leerFirmaGuardada(); if (g) usarFirma(g); };
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
  usarFirma(c.toDataURL('image/png'));
};

// con el celular
// modo 'firma' (por defecto) o 'foto': el mismo diálogo del código QR sirve para los dos; el modo viaja en movilIniciar
let modoMovil = 'firma';
export function abrirMovil(modo = 'firma') {
  modoMovil = modo === 'foto' ? 'foto' : 'firma';
  $('movilTitulo').dataset.i18n = modoMovil === 'foto' ? 'index.fotoCelularTitulo' : 'index.firmarCelular';
  $('movilPaso3').dataset.i18n = modoMovil === 'foto' ? 'index.paso3Foto' : 'index.paso3';
  traducirDOM($('dlgMovil'));
  cerrarModal('dlgFirma'); $('qrImg').classList.add('hidden'); $('qrEspera').classList.remove('hidden'); $('qrEspera').textContent = t('firmar.preparando');
  abrirModal('dlgMovil'); post(modoMovil === 'foto' ? { tipo: 'movilIniciar', modo: 'foto' } : { tipo: 'movilIniciar' });
}
$('fMovil').onclick = () => {
  if (!puente) { toast(t('firmar.soloWindows'), true, 5000); return; }
  abrirMovil('firma');
};
$('movilCancelarBtn').onclick = () => { post({ tipo: 'movilCancelar' }); cerrarModal('dlgMovil'); };

alMensaje('firmaMovil', (m) => { if (!$('dlgMovil').classList.contains('hidden')) { cerrarModal('dlgMovil'); usarFirma(m.png); } });
alMensaje('movilQR', (m) => { $('qrImg').src = m.qr; $('qrImg').classList.remove('hidden'); $('qrEspera').classList.add('hidden'); });
alMensaje('movilVencido', () => {
  if ($('dlgMovil').classList.contains('hidden')) return;
  $('qrImg').classList.add('hidden');
  const q = $('qrEspera'); q.classList.remove('hidden'); q.textContent = t('firmar.vencio');
  const b = document.createElement('button'); b.className = 'btn primary grande'; b.textContent = t('firmar.crearNuevo');
  b.style.marginTop = '16px';
  b.onclick = () => { q.textContent = t('firmar.preparando'); post(modoMovil === 'foto' ? { tipo: 'movilIniciar', modo: 'foto' } : { tipo: 'movilIniciar' }); };
  q.appendChild(document.createElement('br')); q.appendChild(b);
});
alMensaje('movilError', (m) => { cerrarModal('dlgMovil'); toast(m.mensaje || t('firmar.sinConexion'), true, 7000); });
