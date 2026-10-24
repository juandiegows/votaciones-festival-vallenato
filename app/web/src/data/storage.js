// Persistencia simulada en localStorage (reemplaza al backend en el prototipo)
import { crearDatosSemilla } from './seed.js';

// v5: categorías abiertas con audio para la demostración (acordeoneros, piquería, parrandas y aires)
export const CLAVE_DATOS = 'flv_datos_v5';
const CLAVE_SESION = 'flv_sesion_v3';

export function cargarDatos() {
  try {
    const raw = localStorage.getItem(CLAVE_DATOS);
    // Los datos guardados antes de existir las revistas no traen la colección
    if (raw) return { revistas: [], ...JSON.parse(raw) };
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
