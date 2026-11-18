// Persistencia simulada en localStorage (reemplaza al backend en el prototipo)
import { crearDatosSemilla, cuentasDemoRoles, rolesIniciales } from './seed.js';
import { siguienteId } from '../utils/helpers.js';

// v5: categorías abiertas con audio para la demostración (acordeoneros, piquería, parrandas y aires)
export const CLAVE_DATOS = 'flv_datos_v5';
const CLAVE_SESION = 'flv_sesion_v3';

/**
 * Completa los datos guardados con una versión anterior del prototipo sin borrar los cambios del navegador:
 * revistas, los roles del sistema que falten y las cuentas de demostración de «Solo lectura» y «Lectura y escritura».
 */
export function completarDatos(datos) {
  const d = { revistas: [], ...datos };
  const roles = Array.isArray(d.roles) ? [...d.roles] : [];
  rolesIniciales().forEach((rol) => {
    if (!roles.some((r) => r.codigo === rol.codigo)) roles.push({ ...rol, id: siguienteId(roles) });
  });
  d.roles = roles;
  const usuarios = Array.isArray(d.usuarios) ? [...d.usuarios] : [];
  cuentasDemoRoles().forEach((cuenta) => {
    if (usuarios.some((u) => u.correo.toLowerCase() === cuenta.correo)) return;
    const id = usuarios.some((u) => u.id === cuenta.id) ? siguienteId(usuarios) : cuenta.id;
    const documentoLibre = !usuarios.some((u) => u.numeroDocumento === cuenta.numeroDocumento);
    usuarios.push({ ...cuenta, id, numeroDocumento: documentoLibre ? cuenta.numeroDocumento : null });
  });
  d.usuarios = usuarios;
  return d;
}

export function cargarDatos() {
  try {
    const raw = localStorage.getItem(CLAVE_DATOS);
    if (raw) return completarDatos(JSON.parse(raw));
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
