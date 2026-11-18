// Valores con los que se crea cada edición, categoría o votación nueva (Configuración → Valores por defecto).
// La API aplica los mismos cuando un campo no se envía (votaciones/sitio/predeterminados.py).
export const PREDETERMINADOS_BASE = {
  defectoPresentacionCategorias: 'tarjetas',
  defectoResultados: 'al cerrar',
  defectoVotoUnico: true,
  defectoCategoriaActiva: true,
  defectoPresentacionOpciones: 'tarjetas',
  defectoDiasVotacion: 7,
};

/** Configuración del sitio (posiblemente sin estos campos) → valores por defecto completos */
export function valoresPorDefecto(configuracion) {
  const c = configuracion || {};
  return Object.fromEntries(Object.entries(PREDETERMINADOS_BASE).map(([clave, base]) => [clave, c[clave] ?? base]));
}
