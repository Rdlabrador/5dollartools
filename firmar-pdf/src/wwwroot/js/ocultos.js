// Privacidad: un recuadro "ocultar" sin aplicar solo tapa el texto con negro (el texto sigue debajo y se puede recuperar).
// Por eso NINGUNA operación que produzca bytes o texto del documento puede correr con zonas sin aplicar:
// documento.js (bytesActuales, cambiarDocumento) llama a exigirOcultos() y aborta si el usuario cancela. construirPdf nunca dibuja
// estos recuadros (no pueden "hornearse" como negro sobre texto vivo): solo aplicarOcultar (proteger.js) los convierte en página-imagen.
import { E } from './estado.js';
import { confirmar, ocultarCarga } from './util.js';
import { agregar, t } from './i18n.js';

agregar({
  es: {
    'ocultos.casilla': 'Borrar también el título, asunto, palabras clave y marcadores del documento',
    'ocultos.titulo': 'Zonas sin aplicar',
    'ocultos.mensaje': 'Tiene zonas marcadas para ocultar que aún no se aplicaron. Hay que aplicarlas antes de seguir: si no, el texto quedaría debajo del recuadro negro y se podría recuperar.',
    'ocultos.aplicar': 'Aplicar y continuar',
    'ocultos.cancelado': 'Cancelado',
  },
  en: {
    'ocultos.casilla': "Also erase the document's title, subject, keywords and bookmarks",
    'ocultos.titulo': 'Areas not applied yet',
    'ocultos.mensaje': 'You have areas marked to hide that have not been applied yet. They must be applied before going on. Otherwise the text would stay under the black box and could be recovered.',
    'ocultos.aplicar': 'Apply and continue',
    'ocultos.cancelado': 'Cancelled',
  },
});

export const hayOcultosSinAplicar = () => E.items.some((i) => i.tipo === 'ocultar');

// → true si se puede continuar (no había nada pendiente, o se aplicó); false si el usuario canceló o no se pudo aplicar.
export async function asegurarOcultos() {
  if (!hayOcultosSinAplicar()) return true;
  ocultarCarga(); // si venía una pantalla de espera, que no tape la pregunta
  const casilla = { texto: t('ocultos.casilla'), marcada: true };
  const si = await confirmar(t('ocultos.titulo'), t('ocultos.mensaje'), t('ocultos.aplicar'), t('util.cancelar'), casilla);
  if (!si) return false;
  if (!E.aplicarOcultar) return false;
  const ok = await E.aplicarOcultar({ limpiarMeta: casilla.marcada });
  return !!ok && !hayOcultosSinAplicar();
}

// Igual, pero lanza un error "cancelado" (para las funciones que devuelven bytes o texto).
export async function exigirOcultos() {
  if (!(await asegurarOcultos())) throw Object.assign(new Error(t('ocultos.cancelado')), { cancelado: true });
}
