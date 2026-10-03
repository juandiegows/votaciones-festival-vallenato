// Reglas de visibilidad pública (votación → categoría activa → edición activa indicada; por defecto, la activa)
const DIA_MS = 86400000;
export const DIAS_VISIBLE_CERRADAS = 7;

/** Las ediciones cerradas no se muestran en el sitio público. */
export const edicionPublica = (edicion) => edicion?.estado === 'activa';

/** Una votación cerrada sigue visible los días configurados en /panel/sitio después de su cierre. */
export function cerradaVisible(votacion, configuracion, ahora = Date.now()) {
  const dias = configuracion?.diasVisibleCerradas ?? DIAS_VISIBLE_CERRADAS;
  return new Date(votacion.fechaCierre).getTime() + dias * DIA_MS > ahora;
}

export function votacionesPublicas({ votaciones, categorias, edicionActiva, configuracion }, edicion = edicionActiva) {
  if (!edicionPublica(edicion)) return [];
  const categoriasVisibles = new Set(
    categorias.filter((c) => c.activa && c.edicionId === edicion.id).map((c) => c.id)
  );
  return votaciones.filter(
    (v) => v.publicada && categoriasVisibles.has(v.categoriaId) && (v.estado !== 'cerrada' || cerradaVisible(v, configuracion))
  );
}
