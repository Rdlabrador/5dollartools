// Fotos del celular: se piden con un código QR (mismo diálogo que la firma) y, al llegar, el usuario elige si van
// dentro de una página (elemento 'imagen', como la firma) o como páginas nuevas al final del documento.
import { E } from './estado.js';
import { $, toast, elegir, cargarImagen, deBase64 } from './util.js';
import { alMensaje, puente } from './puente.js';
import { iniciarColocar } from './elementos.js';
import { abrirMovil } from './firmar.js';
import { cambiarDocumento } from './documento.js';
import { incrustar } from './paginas.js';
import { pdfViewer } from './visor.js';
import { registrarHerramienta } from './herramientas.js';
import { agregar, t, tn } from './i18n.js';

agregar({
  es: {
    'fotomovil.primeroAbra': 'Primero abra un PDF.',
    'fotomovil.soloWindows': 'Mandar fotos desde el celular solo funciona en el programa de Windows.',
    'fotomovil.herr': 'Foto del celular',
    'fotomovil.herrDesc': 'Reciba fotos de su celular escaneando un código',
    'fotomovil.llegaron.1': 'Llegó 1 foto del celular. ¿Qué quiere hacer con ella?',
    'fotomovil.llegaron.n': 'Llegaron {n} fotos del celular. ¿Qué quiere hacer con ellas?',
    'fotomovil.enPagina': 'Ponerla en la página', 'fotomovil.enPaginaN': 'Ponerlas en la página',
    'fotomovil.enPaginaDesc': 'Usted elige con un clic dónde queda y puede moverla o cambiar su tamaño',
    'fotomovil.nueva': 'Agregar como página nueva', 'fotomovil.nuevaN': 'Agregar como páginas nuevas',
    'fotomovil.nuevaDesc': 'Cada foto queda en su propia página, al final del documento',
    'fotomovil.noLlegaron': 'Las fotos no llegaron bien. Inténtelo de nuevo.',
    'fotomovil.desc': 'fotos agregadas como páginas',
    'fotomovil.agregadas.1': 'Se agregó 1 página con la foto.',
    'fotomovil.agregadas.n': 'Se agregaron {n} páginas con las fotos.',
  },
  en: {
    'fotomovil.primeroAbra': 'Open a PDF first.',
    'fotomovil.soloWindows': 'Sending photos from your phone only works in the Windows program.',
    'fotomovil.herr': 'Photo from your phone',
    'fotomovil.herrDesc': 'Receive photos from your phone by scanning a code',
    'fotomovil.llegaron.1': '1 photo arrived from your phone. What would you like to do with it?',
    'fotomovil.llegaron.n': '{n} photos arrived from your phone. What would you like to do with them?',
    'fotomovil.enPagina': 'Put it on the page', 'fotomovil.enPaginaN': 'Put them on the page',
    'fotomovil.enPaginaDesc': 'You click where it goes, and you can move it or change its size',
    'fotomovil.nueva': 'Add as a new page', 'fotomovil.nuevaN': 'Add as new pages',
    'fotomovil.nuevaDesc': 'Each photo gets its own page at the end of the document',
    'fotomovil.noLlegaron': 'The photos did not come through. Please try again.',
    'fotomovil.desc': 'photos added as pages',
    'fotomovil.agregadas.1': '1 page with the photo was added.',
    'fotomovil.agregadas.n': '{n} pages with the photos were added.',
  },
});

export function pedirFotoCelular() {
  if (!E.pdf) { toast(t('fotomovil.primeroAbra'), true); return; }
  if (!puente) { toast(t('fotomovil.soloWindows'), true, 5000); return; }
  abrirMovil('foto');
}
$('bFotoCelular').onclick = pedirFotoCelular;
registrarHerramienta({ id: 'foto-celular', grupo: 'Páginas', titulo: () => t('fotomovil.herr'), descripcion: () => t('fotomovil.herrDesc'), icono: 'imagen', accion: pedirFotoCelular, requierePdf: true });

// Cada foto como página nueva al final, en una hoja del tamaño de la primera página (girada si la foto es apaisada), con margen de 10 mm.
async function comoPaginasNuevas(imagenes) {
  const MARGEN = 10 * 72 / 25.4;
  const ok = await cambiarDocumento(() => t('fotomovil.desc'), async (doc) => {
    const p0 = doc.getPage(0), tam = p0.getSize(), giro = ((Math.round(p0.getRotation().angle) % 360) + 360) % 360;
    const [base1, base2] = giro === 90 || giro === 270 ? [tam.height, tam.width] : [tam.width, tam.height]; // como se ve en pantalla
    for (const src of imagenes) {
      const img = await incrustar(doc, deBase64(src.split(',')[1]));
      let pw = base1, ph = base2;
      if ((img.width > img.height) !== (pw > ph)) [pw, ph] = [ph, pw];
      const s = Math.min((pw - 2 * MARGEN) / img.width, (ph - 2 * MARGEN) / img.height);
      const dw = img.width * s, dh = img.height * s;
      doc.addPage([pw, ph]).drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
    }
  });
  if (ok) {
    toast(tn('fotomovil.agregadas', imagenes.length));
    try { pdfViewer.currentPageNumber = pdfViewer.pagesCount - imagenes.length + 1; } catch (_) { /* nada */ }
  }
}

async function alLlegar(imagenes) {
  if (!E.pdf || !imagenes.length) return;
  const n = imagenes.length;
  const donde = await elegir(tn('fotomovil.llegaron', n), [
    { valor: 'pagina', texto: t(n === 1 ? 'fotomovil.enPagina' : 'fotomovil.enPaginaN'), descripcion: t('fotomovil.enPaginaDesc') },
    { valor: 'nueva', texto: t(n === 1 ? 'fotomovil.nueva' : 'fotomovil.nuevaN'), descripcion: t('fotomovil.nuevaDesc') },
  ]);
  if (!donde) return;
  if (donde === 'nueva') { await comoPaginasNuevas(imagenes); return; }
  try {
    const lista = [];
    for (const src of imagenes) {
      const im = await cargarImagen(src);
      if (!im.naturalWidth || !im.naturalHeight) throw new Error('imagen');
      lista.push({ src, ratio: im.naturalHeight / im.naturalWidth });
    }
    const [primera, ...resto] = lista;
    iniciarColocar('imagen', { src: primera.src, ratio: primera.ratio, cola: resto, indice: 1, total: lista.length });
  } catch (e) { console.error(e); toast(t('fotomovil.noLlegaron'), true, 5000); }
}

alMensaje('fotosMovil', (m) => {
  if ($('dlgMovil').classList.contains('hidden')) return;
  $('dlgMovil').classList.add('hidden');
  const lista = Array.isArray(m.imagenes) ? m.imagenes.filter((x) => typeof x === 'string') : [];
  if (!lista.length) { toast(t('fotomovil.noLlegaron'), true, 5000); return; }
  alLlegar(lista);
});
