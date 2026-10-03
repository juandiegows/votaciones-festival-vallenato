import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

/** Intervalo por defecto para las consultas «en vivo» del panel (ms). */
export const INTERVALO_EN_VIVO = 5000;

/**
 * Ejecuta `cargar()` (acción del proveedor que devuelve { ok, ... }) y, si `intervalo` > 0, la repite
 * mientras la pestaña está visible. También se refresca cuando cambia `version` (escrituras locales).
 * Devuelve { datos, error, cargando, actualizado, refrescar }.
 */
export function useConsultaEnVivo(cargar, claves, { intervalo = 0, activa = true } = {}) {
  const { version } = useApp();
  const [estado, setEstado] = useState({ datos: null, error: '', cargando: true, actualizado: null });
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  const turno = useRef(0);

  const refrescar = useCallback(async () => {
    const mio = ++turno.current;
    setEstado((e) => ({ ...e, cargando: true }));
    const r = await cargarRef.current();
    if (mio !== turno.current) return;
    setEstado((e) =>
      r.ok
        ? { datos: r, error: '', cargando: false, actualizado: new Date() }
        : { datos: e.datos, error: r.error || 'No fue posible cargar los datos.', status: r.status, cargando: false, actualizado: e.actualizado }
    );
  }, []);

  // Al cambiar lo que se consulta (otra votación u otra edición) se descartan los datos anteriores
  const firma = JSON.stringify(claves);
  const firmaAnterior = useRef(firma);
  useEffect(() => {
    if (firmaAnterior.current === firma) return;
    firmaAnterior.current = firma;
    turno.current++;
    setEstado({ datos: null, error: '', cargando: true, actualizado: null });
  }, [firma]);

  useEffect(() => {
    if (!activa) return undefined;
    refrescar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa, version, ...claves]);

  useEffect(() => {
    if (!activa || !intervalo) return undefined;
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') refrescar();
    }, intervalo);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa, intervalo, ...claves]);

  return { ...estado, refrescar };
}
