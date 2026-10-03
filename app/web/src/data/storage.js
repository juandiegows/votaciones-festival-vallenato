// Persistencia simulada en localStorage (reemplaza al backend en el prototipo)
import { crearDatosSemilla } from './seed.js';

// v3: datos con slugs, muestras de audio, contenido del sitio y ediciones 2025/2026
const CLAVE_DATOS = 'flv_datos_v3';
const CLAVE_SESION = 'flv_sesion_v3';

export function cargarDatos() {
  try {
    const raw = localStorage.getItem(CLAVE_DATOS);
    if (raw) return JSON.parse(raw);
  } catch {
    /* almacenamiento no disponible: se usan datos semilla */
  }
  const datos = crearDatosSemilla();
  guardarDatos(datos);
  return datos;
}

export function guardarDatos(datos) {
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
  } catch {
    /* ignorar */
  }
}

export function restablecerDatos() {
  const datos = crearDatosSemilla();
  guardarDatos(datos);
  return datos;
}

export function cargarSesion() {
  try {
    const id = localStorage.getItem(CLAVE_SESION);
    return id ? Number(id) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(usuarioId) {
  try {
    if (usuarioId) localStorage.setItem(CLAVE_SESION, String(usuarioId));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* ignorar */
  }
}
