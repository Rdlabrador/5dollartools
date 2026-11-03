// Panel "Herramientas" (registro de herramientas) y panel lateral de miniaturas (contenedor vacío por ahora).
import { E, on, emit } from './estado.js';
import { $, abrirModal, cerrarModal, textoDe } from './util.js';
import { agregar, t } from './i18n.js';
import { ICONOS, icono as svgIcono } from './iconos.js';

agregar({
  es: {
    'herramientas.grupo.Páginas': 'Páginas', 'herramientas.grupo.Anotar': 'Anotar', 'herramientas.grupo.Convertir': 'Convertir', 'herramientas.grupo.Proteger': 'Proteger',
    'herramientas.proximamente': 'Próximamente', 'herramientas.abraPrimero': 'Abra un PDF primero',
  },
  en: {
    'herramientas.grupo.Páginas': 'Pages', 'herramientas.grupo.Anotar': 'Mark up', 'herramientas.grupo.Convertir': 'Convert', 'herramientas.grupo.Proteger': 'Protect',
    'herramientas.proximamente': 'Coming soon', 'herramientas.abraPrimero': 'Open a PDF first',
  },
});

// Los nombres de grupo son identificadores fijos (en español); lo que se ve en pantalla sale de 'herramientas.grupo.<nombre>'.
export const GRUPOS = ['Páginas', 'Anotar', 'Convertir', 'Proteger'];
const registro = []; // {id, grupo, titulo, descripcion, icono, accion, requierePdf}  (titulo y descripcion: texto o función () => texto)

// titulo y descripcion pueden ser un texto o una función que lo devuelve: () => t('clave'). Con función, el panel se traduce solo al cambiar el idioma.
// registrarHerramienta({id, grupo:'Páginas'|'Anotar'|'Convertir'|'Proteger', titulo, descripcion, icono (nombre de js/iconos.js o SVG en texto), accion, requierePdf=true})
export function registrarHerramienta({ id, grupo, titulo, descripcion = '', icono = 'herramientas', accion, requierePdf = true }) {
  if (!id || !GRUPOS.includes(grupo) || typeof accion !== 'function') throw new Error('Herramienta no válida: ' + id);
  const i = registro.findIndex((h) => h.id === id);
  const h = { id, grupo, titulo, descripcion, icono, accion, requierePdf };
  if (i >= 0) registro[i] = h; else registro.push(h);
  if (!$('dlgHerramientas').classList.contains('hidden')) dibujarPanel();
}
export const herramientasRegistradas = () => registro.map(({ id, grupo, titulo, requierePdf }) => ({ id, grupo, titulo: textoDe(titulo), requierePdf }));

function iconoEn(el, icono) {
  if (ICONOS[icono]) el.innerHTML = svgIcono(icono, 32); else if (/^\s*<svg/i.test(icono)) el.innerHTML = icono; else el.textContent = icono;
}
function dibujarPanel() {
  const cont = $('herrGrupos'); cont.innerHTML = '';
  for (const g of GRUPOS) {
    const sec = document.createElement('section'); sec.className = 'herr-grupo';
    const tg = document.createElement('h3'); tg.textContent = t('herramientas.grupo.' + g); sec.appendChild(tg);
    const lista = registro.filter((h) => h.grupo === g);
    if (!lista.length) {
      const p = document.createElement('p'); p.className = 'proximamente'; p.textContent = t('herramientas.proximamente'); sec.appendChild(p);
    } else {
      const rejilla = document.createElement('div'); rejilla.className = 'herr-rejilla';
      for (const h of lista) {
        const b = document.createElement('button'); b.className = 'btn herr-tarjeta'; b.dataset.id = h.id;
        const off = h.requierePdf && !E.pdf; b.disabled = off;
        if (off) b.title = t('herramientas.abraPrimero');
        const ic = document.createElement('span'); ic.className = 'herr-ic'; iconoEn(ic, h.icono);
        const tx = document.createElement('span'); tx.className = 'herr-tx';
        const ti = document.createElement('b'); ti.textContent = textoDe(h.titulo);
        const de = document.createElement('small'); de.textContent = textoDe(h.descripcion);
        tx.appendChild(ti); tx.appendChild(de); b.appendChild(ic); b.appendChild(tx);
        b.onclick = () => { cerrarModal('dlgHerramientas'); Promise.resolve().then(() => h.accion()).catch((e) => console.error(e)); };
        rejilla.appendChild(b);
      }
      sec.appendChild(rejilla);
    }
    cont.appendChild(sec);
  }
}
export function abrirHerramientas() { dibujarPanel(); abrirModal('dlgHerramientas'); }
$('bHerramientas').onclick = abrirHerramientas;
on('documentoCargado', () => { if (!$('dlgHerramientas').classList.contains('hidden')) dibujarPanel(); });
on('idioma', () => { if (!$('dlgHerramientas').classList.contains('hidden')) dibujarPanel(); });

// ---------- panel lateral de miniaturas (la fase 1 lo llena) ----------
export function mostrarMiniaturas(ver) {
  const v = ver === undefined ? !document.body.classList.contains('con-miniaturas') : !!ver;
  document.body.classList.toggle('con-miniaturas', v);
  $('bPaginas').classList.toggle('on', v);
  emit('miniaturas', v);
}
$('bPaginas').onclick = () => mostrarMiniaturas();
