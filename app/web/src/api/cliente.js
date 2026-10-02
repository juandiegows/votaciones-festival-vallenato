// Cliente HTTP de la API REST (Django). Nunca lanza excepciones: siempre devuelve
// { ok: true, datos, status } o { ok: false, error, status, codigo, errores }.
import { API_URL } from '../config.js';

const CLAVE_TOKEN = 'flv_token_v1';

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* almacenamiento no disponible */
  }
}

const MENSAJES_HTTP = {
  401: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'El recurso solicitado no existe.',
  429: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
};

/** Convierte el cuerpo de error de DRF en un mensaje legible y errores por campo. */
export function interpretarError(cuerpo, status) {
  if (cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo)) {
    if (typeof cuerpo.detail === 'string') return { error: cuerpo.detail, codigo: cuerpo.codigo, errores: {} };
    const errores = {};
    const mensajes = [];
    Object.entries(cuerpo).forEach(([campo, valor]) => {
      const texto = Array.isArray(valor) ? valor.join(' ') : typeof valor === 'string' ? valor : '';
      if (!texto) return;
      errores[campo] = texto;
      mensajes.push(texto);
    });
    if (mensajes.length) return { error: mensajes.join(' '), errores };
  }
  if (Array.isArray(cuerpo) && cuerpo.length) return { error: cuerpo.join(' '), errores: {} };
  return { error: MENSAJES_HTTP[status] || `Error del servidor (${status}). Inténtalo de nuevo.`, errores: {} };
}

let alExpirarSesion = null;
/** Permite al proveedor cerrar la sesión local cuando la API responde 401 con un token guardado. */
export function alPerderSesion(fn) {
  alExpirarSesion = fn;
}

async function peticionCruda(metodo, ruta, cuerpo) {
  const token = leerToken();
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Token ${token}`;
  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    if (respuesta.status === 401 && token && alExpirarSesion) alExpirarSesion();
    return { respuesta };
  } catch {
    return { errorRed: true };
  }
}

export async function peticion(metodo, ruta, cuerpo) {
  const { respuesta, errorRed } = await peticionCruda(metodo, ruta, cuerpo);
  if (errorRed) {
    return { ok: false, status: 0, error: 'No fue posible conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', errores: {} };
  }
  let datos = null;
  if (respuesta.status !== 204) {
    const texto = await respuesta.text();
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = texto;
    }
  }
  if (respuesta.ok) return { ok: true, status: respuesta.status, datos };
  return { ok: false, status: respuesta.status, ...interpretarError(datos, respuesta.status) };
}

export const api = {
  get: (ruta) => peticion('GET', ruta),
  post: (ruta, cuerpo = {}) => peticion('POST', ruta, cuerpo),
  patch: (ruta, cuerpo) => peticion('PATCH', ruta, cuerpo),
  delete: (ruta) => peticion('DELETE', ruta),
};

/** GET que lanza un Error con el mensaje de la API (útil con Promise.all al cargar colecciones). */
export async function obtener(ruta) {
  const r = await api.get(ruta);
  if (!r.ok) {
    const error = new Error(r.error);
    error.status = r.status;
    throw error;
  }
  return r.datos;
}

/** Descarga un archivo protegido (p. ej. CSV) con el token y lo entrega al navegador. */
export async function descargarArchivo(ruta, nombrePorDefecto) {
  const { respuesta, errorRed } = await peticionCruda('GET', ruta);
  if (errorRed) return { ok: false, error: 'No fue posible conectar con el servidor.' };
  if (!respuesta.ok) {
    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch {
      /* sin cuerpo JSON */
    }
    return { ok: false, status: respuesta.status, ...interpretarError(cuerpo, respuesta.status) };
  }
  const disposicion = respuesta.headers.get('Content-Disposition') || '';
  const nombre = /filename="?([^";]+)"?/i.exec(disposicion)?.[1] || nombrePorDefecto;
  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, nombre };
}
