import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

/**
 * Resultados de una votación. Público: respeta la visibilidad configurada (la API responde 403
 * mientras no sean públicos). Administrador (`admin: true`): siempre visibles.
 */
export function useResultados(votacionId, { admin = false } = {}) {
  const { obtenerResultados, version } = useApp();
  const [estado, setEstado] = useState({ cargando: true, total: 0, filas: [], error: '', status: 0 });

  useEffect(() => {
    if (!votacionId) return undefined;
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true }));
    obtenerResultados(votacionId, { admin }).then((r) => {
      if (!vigente) return;
      if (r.ok) setEstado({ cargando: false, total: r.total, filas: r.filas, error: '', status: 200 });
      else setEstado({ cargando: false, total: 0, filas: [], error: r.error, status: r.status });
    });
    return () => {
      vigente = false;
    };
    // `version` cambia con cada escritura (p. ej. un voto nuevo) para refrescar los resultados
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votacionId, admin, version]);

  return estado;
}
