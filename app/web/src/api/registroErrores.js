// Reporte de errores de JavaScript a los registros del sistema (POST /api/registros/web/, se consultan en
// /panel/registros). Fuentes: window.onerror, promesas rechazadas sin atrapar y el ErrorBoundary de React
// (components/LimiteErrores.jsx). Solo con la API (VITE_API_URL); en el modo demostración se escriben en la consola.
//
// Contra tormentas de errores: el mismo mensaje + archivo + línea se envía como máximo una vez por minuto y no se
// envían más de LIMITE_POR_CARGA reportes por carga de página. Este módulo nunca lanza excepciones.
import { API_URL, MODO_API } from '../config.js';
import { leerToken } from './cliente.js';

const LIMITE_POR_CARGA = 10;
const VENTANA_REPETIDO_MS = 60_000;
// Límites del serializador ErrorClienteSerializer de la API
const MAX = { mensaje: 2000, tipo: 120, traza: 20000, componentes: 10000, archivo: 500, url: 500 };

let enviados = 0;
const ultimoEnvio = new Map();
let instalado = false;

const recortar = (texto, maximo) => (texto ? String(texto).slice(0, maximo) : '');
const entero = (valor) => (Number.isInteger(valor) && valor >= 0 ? valor : null);

/** Primera línea de la traza con archivo:línea:columna (Chrome «at f (url:1:2)» o Firefox «f@url:1:2»). */
function ubicacionDeTraza(traza) {
  const m = /(?:\(|@|at )((?:https?|file|blob):\/\/[^\s)]+?):(\d+):(\d+)\)?\s*$/m.exec(traza || '');
  return m ? { archivo: m[1], linea: Number(m[2]), columna: Number(m[3]) } : {};
}

/** Convierte cualquier valor lanzado (Error, texto, objeto) en el cuerpo que espera la API. */
function normalizar(error, extra = {}) {
  const esError = error instanceof Error;
  const mensaje = extra.mensaje || (esError ? error.message : typeof error === 'string' ? error : (() => {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  })());
  const traza = esError ? error.stack || '' : '';
  const ubicacion = extra.archivo ? {} : ubicacionDeTraza(traza);
  return {
    mensaje: recortar(mensaje || 'Error sin mensaje', MAX.mensaje),
    tipo: recortar(extra.tipo || (esError ? error.name : 'Error'), MAX.tipo),
    traza: recortar(traza, MAX.traza),
    componentes: recortar(extra.componentes, MAX.componentes),
    archivo: recortar(extra.archivo || ubicacion.archivo, MAX.archivo),
    linea: entero(extra.linea ?? ubicacion.linea),
    columna: entero(extra.columna ?? ubicacion.columna),
    url: recortar(typeof window !== 'undefined' ? window.location.href : '', MAX.url),
    // La app no expone un número de versión: el campo `version` se omite
  };
}

/** Errores que no vale la pena registrar (ruido del navegador o ya registrados por el servidor). */
function ignorar(error, cuerpo) {
  // 5xx de la API: el interceptor del servidor ya lo registró con su referencia
  if (error && typeof error === 'object' && (error.referencia || error.status >= 500)) return true;
  // Scripts de otro dominio sin CORS: el navegador oculta todo el detalle
  if (cuerpo.mensaje === 'Script error.' && !cuerpo.archivo) return true;
  if (/^ResizeObserver loop/.test(cuerpo.mensaje)) return true;
  return false;
}

/**
 * Registra un error de JavaScript. `extra` admite { tipo, componentes, archivo, linea, columna, mensaje }.
 * Nunca lanza, aunque el envío falle.
 */
export function reportarError(error, extra = {}) {
  try {
    const cuerpo = normalizar(error, extra);
    if (ignorar(error, cuerpo)) return;
    if (!MODO_API) {
      console.error('[Registro de errores · modo demostración, no se envía]', error, cuerpo);
      return;
    }
    const clave = `${cuerpo.mensaje}|${cuerpo.archivo}|${cuerpo.linea ?? ''}`;
    const ahora = Date.now();
    if (ahora - (ultimoEnvio.get(clave) || 0) < VENTANA_REPETIDO_MS) return;
    if (enviados >= LIMITE_POR_CARGA) return;
    ultimoEnvio.set(clave, ahora);
    enviados += 1;

    const cabeceras = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const token = leerToken();
    if (token) cabeceras.Authorization = `Token ${token}`;
    // keepalive: el reporte llega aunque la persona cierre o recargue la página justo después del error
    fetch(`${API_URL}/registros/web/`, { method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpo), keepalive: true })
      .catch(() => { /* el reporte es opcional: si falla, no se hace nada */ });
  } catch {
    /* nunca lanzar desde el registro de errores */
  }
}

/** Escucha los errores globales del navegador. Se llama una sola vez al iniciar la app (main.jsx). */
export function instalarRegistroErrores() {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  window.addEventListener('error', (evento) => {
    // Fallos al cargar recursos (img, script) llegan sin `message`: no son errores de JavaScript
    if (!evento.message && !evento.error) return;
    reportarError(evento.error || evento.message, {
      mensaje: evento.error ? undefined : evento.message,
      archivo: evento.filename,
      linea: evento.lineno,
      columna: evento.colno,
    });
  });
  window.addEventListener('unhandledrejection', (evento) => {
    const motivo = evento.reason;
    reportarError(motivo, { tipo: motivo instanceof Error ? `Promesa rechazada (${motivo.name})` : 'Promesa rechazada' });
  });
}
