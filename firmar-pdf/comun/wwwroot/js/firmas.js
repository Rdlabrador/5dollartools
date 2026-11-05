// Firmas guardadas (varias): lista en localStorage 'firmarpdf.firmas' = [{id, nombre, png, creada, usada?}]. Máximo 10.
import { CLAVE_FIRMA, CLAVE_FIRMAS, MAX_FIRMAS } from './estado.js';
import { agregar, t } from './i18n.js';

agregar({
  es: {
    'firmar.miFirma': 'Mi firma',
    'firmar.firmaN': 'Firma {n}',
    'firmar.sinEspacio': 'No hay espacio para guardar la firma. Elimine alguna firma guardada e inténtelo de nuevo.',
  },
  en: {
    'firmar.miFirma': 'My signature',
    'firmar.firmaN': 'Signature {n}',
    'firmar.sinEspacio': 'There is no room to save the signature. Delete a saved signature and try again.',
  },
});

const valida = (f) => f && typeof f.png === 'string' && f.png.startsWith('data:image') && typeof f.id === 'string';
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Escribe la lista. Devuelve true si quedó bien guardada.
function escribir(lista) {
  try { const s = JSON.stringify(lista); localStorage.setItem(CLAVE_FIRMAS, s); return localStorage.getItem(CLAVE_FIRMAS) === s; }
  catch (_) { return false; }
}

export function leerFirmas() {
  let crudo = null;
  try { crudo = localStorage.getItem(CLAVE_FIRMAS); } catch (_) { return []; }
  if (crudo === null) {
    // migración: la firma única de antes pasa a ser la primera
    let vieja = null;
    try { vieja = localStorage.getItem(CLAVE_FIRMA); } catch (_) { /* nada */ }
    if (vieja && vieja.startsWith('data:image')) {
      const lista = [{ id: 'migrada', nombre: t('firmar.miFirma'), png: vieja, creada: new Date().toISOString() }];
      // la clave vieja se borra solo si la nueva quedó bien escrita
      if (escribir(lista)) { try { localStorage.removeItem(CLAVE_FIRMA); } catch (_) { /* nada */ } }
      return lista;
    }
    return [];
  }
  try { const a = JSON.parse(crudo); return Array.isArray(a) ? a.filter(valida) : []; }
  catch (_) {
    // lista dañada: se guarda una copia antes de que el próximo guardado la reemplace
    try { if (localStorage.getItem(CLAVE_FIRMAS + '.bak') === null) localStorage.setItem(CLAVE_FIRMAS + '.bak', crudo); } catch (_) { /* nada */ }
    return [];
  }
}

export const hayEspacio = () => leerFirmas().length < MAX_FIRMAS;

// Agrega una firma; devuelve la firma creada, o null si ya hay 10 o no cabe en el almacenamiento.
export function agregarFirma(png, nombre) {
  const lista = leerFirmas();
  if (lista.length >= MAX_FIRMAS) return null;
  const f = { id: nuevoId(), nombre: (nombre || '').trim() || t('firmar.firmaN', { n: lista.length + 1 }), png, creada: new Date().toISOString() };
  lista.push(f);
  return escribir(lista) ? f : null;
}
function cambiar(id, fn) {
  const lista = leerFirmas(); const f = lista.find((x) => x.id === id); if (!f) return false;
  fn(f); return escribir(lista);
}
export const renombrarFirma = (id, nombre) => cambiar(id, (f) => { f.nombre = (nombre || '').trim() || f.nombre; });
export const marcarUsada = (id) => cambiar(id, (f) => { f.usada = new Date().toISOString(); });
export const eliminarFirma = (id) => escribir(leerFirmas().filter((x) => x.id !== id));
export function limpiarFirmas() { try { localStorage.removeItem(CLAVE_FIRMAS); localStorage.removeItem(CLAVE_FIRMA); } catch (_) { /* nada */ } }
// la recomendada: la última que se usó; si ninguna se ha usado, la primera
export function recomendada(lista) {
  let mejor = null;
  for (const f of lista) if (f.usada && (!mejor || f.usada > mejor.usada)) mejor = f;
  return mejor || lista[0] || null;
}
