import { createContext, useContext } from 'react';

/**
 * Contrato común de los dos proveedores de datos (demostración y API):
 *  - Colecciones (camelCase): ediciones, categorias, votaciones (con `estado`), opciones, votos, usuarios, auditoria.
 *  - Sesión: usuario (con rol, rolNombre y permisos), misVotos, edicionActiva (o null si no hay una activa).
 *  - Permisos: `permisos` (códigos del rol, ver src/data/permisos.js), `puede(codigo)` y `esAdmin`, que significa
 *    «accede al panel» (panel.ver), no «es el rol administrador». Roles: roles, catalogoPermisos, cambiarRol,
 *    guardarRol y eliminarRol (mismas reglas que la API: nadie cambia su rol ni reparte permisos que no tiene).
 *  - Acciones ASÍNCRONAS que devuelven { ok: true, ... } o { ok: false, error, errores? }:
 *    iniciarSesion, cerrarSesion, registrarUsuario, emitirVoto, guardarEntidad, eliminarEntidad,
 *    reemplazarColeccion, obtenerResultados, exportarResultados (csv, excel o pdf), cargarAuditoria, restablecer (solo demostración),
 *    cargarRegistros, obtenerResumenRegistros y provocarErrorPrueba (registros técnicos, permiso registros.ver).
 *  - Verificación en dos pasos (RF-20): iniciarSesion puede devolver { ok: true, requiere2fa, metodo, desafio };
 *    verificarDosPasos(desafio, codigo) abre la sesión. `dosPasos` agrupa la configuración de Mi cuenta → Seguridad
 *    (null en la demostración: necesita la API).
 *  - `version` cambia con cada escritura (para refrescar consultas como los resultados).
 */
export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

/** Edición activa (la más reciente si hubiera varias) o null. */
export function buscarEdicionActiva(ediciones) {
  return [...ediciones].filter((e) => e.estado === 'activa').sort((a, b) => b.anio - a.anio)[0] || null;
}

/** Función `puede(codigo)` a partir de la lista de permisos del usuario (vacía si no hay sesión). */
export function crearPuede(permisos) {
  const conjunto = new Set(permisos || []);
  return (codigo) => conjunto.has(codigo);
}
