/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from './AppContext.jsx';

const CLAVE = 'flv_admin_edicion';
const EdicionAdminContext = createContext(null);

function leerGuardada() {
  try {
    return Number(localStorage.getItem(CLAVE)) || null;
  } catch {
    return null;
  }
}

/**
 * Edición que el administrador está consultando (por defecto, la activa). Todas las pantallas de
 * administración (panel, categorías, votaciones, resultados y auditoría) trabajan sobre ella, así
 * que también se pueden revisar ediciones anteriores con sus resultados.
 */
export function EdicionAdminProvider({ children }) {
  const { ediciones, categorias, votaciones, opciones, votos, edicionActiva } = useApp();
  const [elegida, setElegida] = useState(leerGuardada);

  const edicion = ediciones.find((e) => e.id === elegida) || edicionActiva || [...ediciones].sort((a, b) => b.anio - a.anio)[0] || null;

  useEffect(() => {
    try {
      if (elegida) localStorage.setItem(CLAVE, String(elegida));
      else localStorage.removeItem(CLAVE);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [elegida]);

  const valor = useMemo(() => {
    const cats = categorias.filter((c) => c.edicionId === edicion?.id);
    const idsCat = new Set(cats.map((c) => c.id));
    const vots = votaciones.filter((v) => idsCat.has(v.categoriaId));
    const idsVot = new Set(vots.map((v) => v.id));
    return {
      edicion,
      edicionId: edicion?.id ?? null,
      esActiva: !!edicion && edicion.id === edicionActiva?.id,
      setEdicionId: (id) => setElegida(id ? Number(id) : null),
      ediciones: [...ediciones].sort((a, b) => b.anio - a.anio),
      categorias: cats,
      votaciones: vots,
      opciones: opciones.filter((o) => idsVot.has(o.votacionId)),
      votos: votos.filter((v) => idsVot.has(v.votacionId)),
    };
  }, [edicion, edicionActiva, ediciones, categorias, votaciones, opciones, votos]);

  return <EdicionAdminContext.Provider value={valor}>{children}</EdicionAdminContext.Provider>;
}

export function useEdicionAdmin() {
  return useContext(EdicionAdminContext);
}
