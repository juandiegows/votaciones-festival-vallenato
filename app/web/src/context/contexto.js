import { createContext, useContext } from 'react';

/**
 * Contrato común de los dos proveedores de datos (demostración y API):
 *  - Colecciones (camelCase): ediciones, categorias, votaciones (con `estado`), opciones, votos, usuarios, auditoria.
 *  - Sesión: usuario, esAdmin, misVotos, edicionActiva (o null si no hay una activa).
 *  - Acciones ASÍNCRONAS que devuelven { ok: true, ... } o { ok: false, error, errores? }:
 *    iniciarSesion, cerrarSesion, registrarUsuario, emitirVoto, guardarEntidad, eliminarEntidad,
 *    reemplazarColeccion, obtenerResultados, exportarResultadosCSV, cargarAuditoria, restablecer (solo demostración).
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
