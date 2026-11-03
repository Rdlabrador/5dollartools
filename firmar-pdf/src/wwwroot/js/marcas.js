// Fase 2: marca de agua y números de página (cambian el documento, con deshacer).
import { E } from './estado.js';
import { $, toast, abrirModal, cerrarModal, analizarRango } from './util.js';
import { cambiarDocumento } from './documento.js';
import { obtenerPagina } from './guardar.js';
import { registrarHerramienta } from './herramientas.js';
import { agregar, t } from './i18n.js';

agregar({
  es: {
    'marcas.copia': 'COPIA',
    'marcas.escribaMarca': 'Escriba el texto de la marca de agua.',
    'marcas.descMarca': 'Poniendo la marca de agua',
    'marcas.listoSimbolos': 'Listo. Algunos símbolos no se pueden guardar y se cambiaron por "?".',
    'marcas.marcaPuesta': 'Marca de agua puesta.',
    'marcas.inicioMal': 'El número inicial debe ser entero, entre 0 y 99999.',
    'marcas.descNumeros': 'Poniendo los números de página',
    'marcas.numerosPuestos': 'Números de página puestos.',
    'marcas.sufPagina': 'Página {num}',
    'marcas.sufPaginaDe': 'Página {num} de {total}',
    'marcas.aplicar': 'Aplicar',
    'marcas.todas': 'Todas las páginas',
    'marcas.algunas': 'Solo algunas',
    'marcas.ejemploRango': 'Por ejemplo 1-3, 5 (de 1 a {total})',
    'marcas.tituloMarca': 'Marca de agua',
    'marcas.textoMarca': 'Texto de la marca',
    'marcas.tamano': 'Tamaño',
    'marcas.pequeno': 'Pequeño',
    'marcas.mediano': 'Mediano',
    'marcas.grande': 'Grande',
    'marcas.color': 'Color',
    'marcas.gris': 'Gris',
    'marcas.rojo': 'Rojo',
    'marcas.azul': 'Azul',
    'marcas.fuerza': 'Qué tan fuerte se ve',
    'marcas.suave': 'Suave',
    'marcas.normal': 'Normal',
    'marcas.fuerte': 'Fuerte',
    'marcas.direccion': 'Dirección',
    'marcas.diagonal': 'En diagonal',
    'marcas.derecha': 'Derecha',
    'marcas.paginas': 'Páginas',
    'marcas.escribaTexto': 'Escriba el texto de la marca.',
    'marcas.muyLargo': 'El texto es muy largo (máximo 40 letras).',
    'marcas.tituloNumeros': 'Números de página',
    'marcas.donde': 'Dónde',
    'marcas.abajoCentro': 'Abajo al centro',
    'marcas.abajoDerecha': 'Abajo a la derecha',
    'marcas.arribaDerecha': 'Arriba a la derecha',
    'marcas.comoEscribe': 'Cómo se escribe',
    'marcas.empezarEn': 'Empezar en el número',
    'marcas.saltarPrimera': 'No poner número en la primera página',
    'marcas.tamLetra': 'Tamaño de la letra',
    'marcas.chica': 'Chica',
    'marcas.mediana': 'Mediana',
    'marcas.escribaInicio': 'Escriba con qué número empieza.',
    'marcas.agua': 'Marca de agua',
    'marcas.aguaDesc': 'Ponga un texto grande como "COPIA" o "BORRADOR"',
    'marcas.numeros': 'Números de página',
    'marcas.numerosDesc': 'Numere las páginas del documento',
  },
  en: {
    'marcas.copia': 'COPY',
    'marcas.escribaMarca': 'Please type the text for the watermark.',
    'marcas.descMarca': 'Adding the watermark',
    'marcas.listoSimbolos': 'Done. Some symbols cannot be saved and were changed to "?".',
    'marcas.marcaPuesta': 'The watermark was added.',
    'marcas.inicioMal': 'The starting number must be a whole number from 0 to 99999.',
    'marcas.descNumeros': 'Adding page numbers',
    'marcas.numerosPuestos': 'Page numbers were added.',
    'marcas.sufPagina': 'Page {num}',
    'marcas.sufPaginaDe': 'Page {num} of {total}',
    'marcas.aplicar': 'Apply',
    'marcas.todas': 'All pages',
    'marcas.algunas': 'Only some',
    'marcas.ejemploRango': 'For example 1-3, 5 (from 1 to {total})',
    'marcas.tituloMarca': 'Watermark',
    'marcas.textoMarca': 'Watermark text',
    'marcas.tamano': 'Size',
    'marcas.pequeno': 'Small',
    'marcas.mediano': 'Medium',
    'marcas.grande': 'Large',
    'marcas.color': 'Color',
    'marcas.gris': 'Gray',
    'marcas.rojo': 'Red',
    'marcas.azul': 'Blue',
    'marcas.fuerza': 'How strong it looks',
    'marcas.suave': 'Light',
    'marcas.normal': 'Normal',
    'marcas.fuerte': 'Strong',
    'marcas.direccion': 'Direction',
    'marcas.diagonal': 'Diagonal',
    'marcas.derecha': 'Straight',
    'marcas.paginas': 'Pages',
    'marcas.escribaTexto': 'Please type the watermark text.',
    'marcas.muyLargo': 'The text is too long (40 letters at most).',
    'marcas.tituloNumeros': 'Page numbers',
    'marcas.donde': 'Where',
    'marcas.abajoCentro': 'Bottom center',
    'marcas.abajoDerecha': 'Bottom right',
    'marcas.arribaDerecha': 'Top right',
    'marcas.comoEscribe': 'How it is written',
    'marcas.empezarEn': 'Start at number',
    'marcas.saltarPrimera': 'Do not number the first page',
    'marcas.tamLetra': 'Letter size',
    'marcas.chica': 'Small',
    'marcas.mediana': 'Medium',
    'marcas.escribaInicio': 'Please type the number to start from.',
    'marcas.agua': 'Watermark',
    'marcas.aguaDesc': 'Add large text such as "COPY" or "DRAFT"',
    'marcas.numeros': 'Page numbers',
    'marcas.numerosDesc': 'Number the pages of the document',
  },
});

// ---------- geometría de una página de pdf-lib (con su giro /Rotate) ----------
export function geometria(pg) {
  const cb = pg.getCropBox ? pg.getCropBox() : pg.getMediaBox();
  const R = ((Math.round(pg.getRotation().angle) % 360) + 360) % 360;
  const bw = cb.width, bh = cb.height;
  return { R, bx: cb.x, by: cb.y, bw, bh, vw: R % 180 ? bh : bw, vh: R % 180 ? bw : bh };
}
// punto (u,v) de la página tal como se ve (origen arriba a la izquierda, y hacia abajo) → punto PDF
export function visualAPdf(g, u, v) {
  switch (g.R) {
    case 90: return [g.bx + v, g.by + u];
    case 180: return [g.bx + g.bw - u, g.by + v];
    case 270: return [g.bx + g.bw - v, g.by + g.bh - u];
    default: return [g.bx + u, g.by + g.bh - v];
  }
}
const COLOR_MARCA = { gris: [0.5, 0.5, 0.5], rojo: [0.85, 0.1, 0.1], azul: [0.1, 0.3, 0.8] };
const FACTOR_TAM = { pequeno: 0.5, mediano: 0.75, grande: 1 };

// tamaño de letra y ángulo de la marca para una página visual vw×vh y un texto de ancho `ancho1` (a tamaño 1)
export function disenoMarca(vw, vh, ancho1, o) {
  const f = FACTOR_TAM[o.tamano] || 0.75, min = Math.min(vw, vh), diag = o.orientacion !== 'horizontal';
  const largo = diag ? 1.1 * min * f : 0.85 * vw * f;
  const size = Math.max(6, Math.min(largo / Math.max(ancho1, 0.01), 0.5 * min));
  return { size, diag, ancho: ancho1 * size };
}
function textoSeguro(fuente, s) {
  let r = '', quito = false;
  for (const ch of s) { try { fuente.encodeText(ch); r += ch; } catch (_) { r += '?'; quito = true; } }
  return { texto: r, quito };
}
const PAGINAS_TODAS = (n) => Array.from({ length: n }, (_, i) => i + 1);

// ================= marca de agua =================
// o: {texto, tamano:'pequeno'|'mediano'|'grande', color:'gris'|'rojo'|'azul', opacidad 0.2-0.5, orientacion:'diagonal'|'horizontal', paginas:[…]|null}
export async function aplicarMarcaAgua(o = {}) {
  const texto = [...String(o.texto == null ? t('marcas.copia') : o.texto).replace(/\s+/g, ' ').trim()].slice(0, 40).join('');
  if (!texto) { toast(t('marcas.escribaMarca'), true); return false; }
  const opacidad = Math.min(0.5, Math.max(0.2, +o.opacidad || 0.3));
  const col = COLOR_MARCA[o.color] || COLOR_MARCA.gris;
  let quito = false;
  const ok = await cambiarDocumento(t('marcas.descMarca'), async (doc, L) => {
    const fuente = await doc.embedFont(L.StandardFonts.HelveticaBold), pgs = doc.getPages();
    const s = textoSeguro(fuente, texto); quito = s.quito;
    const lista = o.paginas && o.paginas.length ? o.paginas : PAGINAS_TODAS(pgs.length);
    const ancho1 = fuente.widthOfTextAtSize(s.texto, 1);
    for (const n of lista) {
      const pg = pgs[n - 1]; if (!pg) continue;
      const g = geometria(pg), d = disenoMarca(g.vw, g.vh, ancho1, o);
      const th = ((g.R + (d.diag ? 45 : 0)) * Math.PI) / 180, cx = g.bx + g.bw / 2, cy = g.by + g.bh / 2;
      const a = -d.ancho / 2, b = -0.36 * d.size; // desde el centro hasta el inicio del texto, en el sistema del texto
      pg.drawText(s.texto, {
        x: cx + a * Math.cos(th) - b * Math.sin(th), y: cy + a * Math.sin(th) + b * Math.cos(th),
        size: d.size, font: fuente, color: L.rgb(col[0], col[1], col[2]), opacity: opacidad, rotate: L.degrees(g.R + (d.diag ? 45 : 0)),
      });
    }
  });
  if (ok) toast(quito ? t('marcas.listoSimbolos') : t('marcas.marcaPuesta'), quito);
  return ok;
}

// ================= números de página =================
const inicioValido = (n) => Number.isInteger(n) && n >= 0 && n <= 99999;
const SUFIJO = (f, num, total) => (f === 'pagina' ? t('marcas.sufPagina', { num }) : f === 'pagina-de' ? t('marcas.sufPaginaDe', { num, total }) : `${num}`);
// o: {posicion:'abajo-centro'|'abajo-derecha'|'arriba-derecha', formato:'1'|'pagina'|'pagina-de', inicio:1, saltarPrimera:false, tamano:12}
export async function numerarPaginas(o = {}) {
  const ini = o.inicio == null || o.inicio === '' ? 1 : +o.inicio;
  if (!inicioValido(ini)) { toast(t('marcas.inicioMal'), true); return false; }
  const tam = Math.min(48, Math.max(6, +o.tamano || 12)), saltar = !!o.saltarPrimera;
  const ok = await cambiarDocumento(t('marcas.descNumeros'), async (doc, L) => {
    const fuente = await doc.embedFont(L.StandardFonts.Helvetica), pgs = doc.getPages(), n = pgs.length;
    const total = ini + n - 1 - (saltar ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (saltar && i === 0) continue;
      const g = geometria(pgs[i]), txt = SUFIJO(o.formato, ini + i - (saltar ? 1 : 0), total);
      const w = fuente.widthOfTextAtSize(txt, tam), pos = o.posicion || 'abajo-centro';
      const u = pos === 'abajo-centro' ? g.vw / 2 - w / 2 : g.vw - 40 - w;
      const v = pos.startsWith('abajo') ? g.vh - 28 : 28 + tam * 0.72;
      const [x, y] = visualAPdf(g, u, v);
      pgs[i].drawText(txt, { x, y, size: tam, font: fuente, color: L.rgb(0.1, 0.1, 0.1), rotate: L.degrees(g.R) });
    }
  });
  if (ok) toast(t('marcas.numerosPuestos'));
  return ok;
}

// ================= formulario con vista previa =================
// campos: [{id, tipo:'texto'|'num'|'seg'|'check'|'paginas', etiqueta, valor, opciones:[{v,t}]}]
// dibujar(canvas, valores) pinta la vista previa. validar(valores) → mensaje o null. Devuelve los valores o null si cancela.
function formulario(titulo, campos, dibujar, validar, okTxt) {
  return new Promise((resolver) => {
    const cont = $('formCampos'), cv = $('formVista'), err = $('formError'), val = {};
    cont.innerHTML = ''; err.classList.add('hidden'); $('formTitulo').textContent = titulo; $('formOk').textContent = okTxt || t('marcas.aplicar');
    const repintar = () => { err.classList.add('hidden'); try { dibujar(cv, val); } catch (e) { console.warn('vista previa', e); } };
    for (const c of campos) {
      const caja = document.createElement('div'); caja.className = 'fcampo';
      val[c.id] = c.tipo === 'paginas' ? { modo: 'todas', texto: '' } : c.valor;
      if (c.tipo === 'check') {
        const lab = document.createElement('label'); lab.className = 'fcheck';
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!c.valor;
        inp.onchange = () => { val[c.id] = inp.checked; repintar(); };
        lab.appendChild(inp); lab.appendChild(document.createTextNode(c.etiqueta)); caja.appendChild(lab);
      } else {
        const et = document.createElement('label'); et.textContent = c.etiqueta; caja.appendChild(et);
        if (c.tipo === 'texto' || c.tipo === 'num') {
          const inp = document.createElement('input'); inp.className = 'campo'; inp.type = c.tipo === 'num' ? 'number' : 'text'; inp.value = c.valor; inp.autocomplete = 'off';
          if (c.tipo === 'num') inp.min = c.min == null ? 1 : c.min;
          inp.oninput = () => { val[c.id] = c.tipo === 'num' ? inp.value : inp.value; repintar(); };
          inp.onkeydown = (e) => { if (e.key === 'Enter') $('formOk').click(); };
          et.htmlFor = inp.id = 'f_' + c.id; caja.appendChild(inp);
        } else {
          const seg = document.createElement('div'); seg.className = 'fseg'; let extra = null;
          const opciones = c.tipo === 'paginas' ? [{ v: 'todas', t: t('marcas.todas') }, { v: 'rango', t: t('marcas.algunas') }] : c.opciones;
          const marcar = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(c.tipo === 'paginas' ? val[c.id].modo : val[c.id])));
          for (const op of opciones) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.v = String(op.v); b.textContent = op.t;
            b.onclick = () => {
              if (c.tipo === 'paginas') { val[c.id].modo = op.v; extra.classList.toggle('hidden', op.v !== 'rango'); if (op.v === 'rango') extra.focus(); } else val[c.id] = op.v;
              marcar(); repintar();
            };
            seg.appendChild(b);
          }
          caja.appendChild(seg);
          if (c.tipo === 'paginas') {
            extra = document.createElement('input'); extra.className = 'campo hidden'; extra.placeholder = t('marcas.ejemploRango', { total: c.total }); extra.autocomplete = 'off';
            extra.oninput = () => { val[c.id].texto = extra.value; err.classList.add('hidden'); };
            caja.appendChild(extra);
          }
          marcar();
        }
      }
      cont.appendChild(caja);
    }
    const fin = (v) => { cerrarModal('dlgForm'); $('formOk').onclick = $('formCancelar').onclick = null; cont.innerHTML = ''; resolver(v); };
    $('formCancelar').onclick = () => fin(null);
    $('formOk').onclick = () => {
      const m = validar ? validar(val) : null;
      if (m) { err.textContent = m; err.classList.remove('hidden'); return; }
      fin({ ...val });
    };
    abrirModal('dlgForm'); repintar();
    const p = cont.querySelector('input.campo'); if (p) { p.focus(); p.select(); }
  });
}
function paginasDe(v, total) { // valor del campo 'paginas' → null (todas) | [n…] | {error}
  if (!v || v.modo === 'todas') return null;
  return analizarRango(v.texto, total);
}
const validarPaginas = (campo, total) => (val) => { const r = paginasDe(val[campo], total); return r && r.error ? r.error : null; };

// proporción de la primera página (para la vista previa)
async function proporcion() {
  try { const p = await obtenerPagina(1); const vp = p.getViewport({ scale: 1 }); return [vp.width, vp.height]; } catch (_) { return [595, 842]; }
}
function hoja(cv, vw, vh) {
  const ctx = cv.getContext('2d'), M = 8, s = Math.min((cv.width - 2 * M) / vw, (cv.height - 2 * M) / vh);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const w = vw * s, h = vh * s, x = (cv.width - w) / 2, y = (cv.height - h) / 2;
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  // líneas de texto de relleno
  ctx.fillStyle = '#e4e4e4';
  for (let yy = y + h * 0.1; yy < y + h * 0.9; yy += h * 0.045) ctx.fillRect(x + w * 0.12, yy, w * 0.76 * (0.7 + 0.3 * Math.abs(Math.sin(yy))), Math.max(2, h * 0.012));
  return { ctx, x, y, w, h, s };
}

async function herrMarcaAgua() {
  const n = E.pdf.numPages, [vw, vh] = await proporcion();
  const val = await formulario(t('marcas.tituloMarca'), [
    { id: 'texto', tipo: 'texto', etiqueta: t('marcas.textoMarca'), valor: t('marcas.copia') },
    { id: 'tamano', tipo: 'seg', etiqueta: t('marcas.tamano'), valor: 'mediano', opciones: [{ v: 'pequeno', t: t('marcas.pequeno') }, { v: 'mediano', t: t('marcas.mediano') }, { v: 'grande', t: t('marcas.grande') }] },
    { id: 'color', tipo: 'seg', etiqueta: t('marcas.color'), valor: 'gris', opciones: [{ v: 'gris', t: t('marcas.gris') }, { v: 'rojo', t: t('marcas.rojo') }, { v: 'azul', t: t('marcas.azul') }] },
    { id: 'opacidad', tipo: 'seg', etiqueta: t('marcas.fuerza'), valor: 0.3, opciones: [{ v: 0.2, t: t('marcas.suave') }, { v: 0.3, t: t('marcas.normal') }, { v: 0.5, t: t('marcas.fuerte') }] },
    { id: 'orientacion', tipo: 'seg', etiqueta: t('marcas.direccion'), valor: 'diagonal', opciones: [{ v: 'diagonal', t: t('marcas.diagonal') }, { v: 'horizontal', t: t('marcas.derecha') }] },
    ...(n > 1 ? [{ id: 'paginas', tipo: 'paginas', etiqueta: t('marcas.paginas'), total: n }] : []),
  ], (cv, v) => {
    const { ctx, x, y, w, h, s } = hoja(cv, vw, vh);
    const txt = String(v.texto || '').trim() || ' ';
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.font = 'bold 100px Helvetica, Arial, sans-serif'; const a1 = ctx.measureText(txt).width / 100;
    const d = disenoMarca(vw, vh, a1, v), c = COLOR_MARCA[v.color] || COLOR_MARCA.gris;
    ctx.globalAlpha = +v.opacidad || 0.3; ctx.fillStyle = `rgb(${c.map((q) => Math.round(q * 255)).join(',')})`;
    ctx.font = `bold ${d.size * s}px Helvetica, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.translate(x + w / 2, y + h / 2); if (d.diag) ctx.rotate(-Math.PI / 4);
    ctx.fillText(txt, 0, 0.36 * d.size * s); ctx.restore();
  }, (v) => (!String(v.texto || '').trim() ? t('marcas.escribaTexto') : [...String(v.texto)].length > 40 ? t('marcas.muyLargo') : validarPaginas('paginas', n)(v)));
  if (!val) return;
  const p = paginasDe(val.paginas, n);
  await aplicarMarcaAgua({ ...val, paginas: p ? p.paginas : null });
}

async function herrNumeros() {
  const n = E.pdf.numPages, [vw, vh] = await proporcion();
  const val = await formulario(t('marcas.tituloNumeros'), [
    { id: 'posicion', tipo: 'seg', etiqueta: t('marcas.donde'), valor: 'abajo-centro', opciones: [{ v: 'abajo-centro', t: t('marcas.abajoCentro') }, { v: 'abajo-derecha', t: t('marcas.abajoDerecha') }, { v: 'arriba-derecha', t: t('marcas.arribaDerecha') }] },
    { id: 'formato', tipo: 'seg', etiqueta: t('marcas.comoEscribe'), valor: '1', opciones: [{ v: '1', t: '1' }, { v: 'pagina', t: t('marcas.sufPagina', { num: 1 }) }, { v: 'pagina-de', t: t('marcas.sufPaginaDe', { num: 1, total: n }) }] },
    { id: 'inicio', tipo: 'num', etiqueta: t('marcas.empezarEn'), valor: 1, min: 0 },
    { id: 'saltarPrimera', tipo: 'check', etiqueta: t('marcas.saltarPrimera'), valor: false },
    { id: 'tamano', tipo: 'seg', etiqueta: t('marcas.tamLetra'), valor: 12, opciones: [{ v: 10, t: t('marcas.chica') }, { v: 12, t: t('marcas.mediana') }, { v: 16, t: t('marcas.grande') }] },
  ], (cv, v) => {
    const { ctx, x, y, w, h, s } = hoja(cv, vw, vh);
    const ini = +v.inicio; const num = inicioValido(ini) ? ini : 1;
    const txt = SUFIJO(v.formato, v.saltarPrimera ? num : num, num + n - 1 - (v.saltarPrimera ? 1 : 0));
    const tam = +v.tamano || 12; ctx.fillStyle = '#1a1a1a'; ctx.font = `${tam * s}px Helvetica, Arial, sans-serif`;
    const tw = ctx.measureText(txt).width / s, pos = v.posicion;
    const u = pos === 'abajo-centro' ? vw / 2 - tw / 2 : vw - 40 - tw, vv = pos.startsWith('abajo') ? vh - 28 : 28 + tam * 0.72;
    ctx.textAlign = 'left'; ctx.fillText(txt, x + u * s, y + vv * s);
  }, (v) => (String(v.inicio).trim() === '' ? t('marcas.escribaInicio') : inicioValido(+v.inicio) ? null : t('marcas.inicioMal')));
  if (!val) return;
  await numerarPaginas({ ...val, inicio: +val.inicio, tamano: +val.tamano });
}

registrarHerramienta({ id: 'marca-agua', grupo: 'Anotar', titulo: () => t('marcas.agua'), descripcion: () => t('marcas.aguaDesc'), icono: 'agua', accion: herrMarcaAgua });
registrarHerramienta({ id: 'numeros-pagina', grupo: 'Anotar', titulo: () => t('marcas.numeros'), descripcion: () => t('marcas.numerosDesc'), icono: 'numeros', accion: herrNumeros });
