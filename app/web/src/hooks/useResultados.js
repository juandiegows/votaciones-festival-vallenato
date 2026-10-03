import { useApp } from '../context/AppContext.jsx';
import { useConsultaEnVivo } from './useConsultaEnVivo.js';

/**
 * Resultados de una votación. Público: respeta la visibilidad configurada (la API responde 403
 * mientras no sean públicos). Administrador (`admin: true`): siempre visibles.
 * `intervalo` (ms) los vuelve a consultar periódicamente (resultados en tiempo real).
 */
export function useResultados(votacionId, { admin = false, intervalo = 0 } = {}) {
  const { obtenerResultados } = useApp();
  const { datos, error, status, cargando, actualizado } = useConsultaEnVivo(
    () => obtenerResultados(votacionId, { admin }),
    [votacionId, admin],
    { intervalo, activa: !!votacionId }
  );
  return {
    cargando: cargando && !datos,
    total: datos?.total || 0,
    filas: datos?.filas || [],
    error,
    status: error ? status : 200,
    actualizado,
  };
}
