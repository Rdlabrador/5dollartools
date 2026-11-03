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

traducirDOM();
pintarIconos();
botones();
post({ tipo: 'listo' });
