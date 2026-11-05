// Firmar PDF — arranque. Habla con el programa de Windows (C#) por window.chrome.webview (ver CONTRATO.md).
// Sin el programa (Chrome normal) funciona en "modo prueba".
import { pintarIconos } from './iconos.js';
import './textos-index.js';
import { traducirDOM } from './i18n.js';
import './menus.js';
import { post } from './puente.js';
import './visor.js';
import './historial.js';
import './documento.js';
import './elementos.js';
import './firmar.js';
import './guardar.js';
import './herramientas.js';
import './anotar.js';
import './buscar.js';
import './marcas.js';
import './teclado.js';
import { botones } from './historial.js';
import './pruebas.js';
import './paginas.js';
import './fotomovil.js';
import './miniaturas.js';
import './proteger.js';
import './convertir.js';

// window.__arranque: marca de avance (la lee el diagnóstico de la prueba de Mac)
window.__arranque = 'modulos';
traducirDOM(); window.__arranque = 'traducido';
pintarIconos(); window.__arranque = 'iconos';
botones(); window.__arranque = 'botones';
post({ tipo: 'listo' }); window.__arranque = 'listo';
