// Reglas de visibilidad pública (votación → categoría activa → edición activa indicada; por defecto, la activa)
const DIA_MS = 86400000;
export const DIAS_VISIBLE_CERRADAS = 7;

/** Días configurados: número, o null cuando las cerradas se muestran siempre (sin dato: el valor por defecto). */
export const diasVisibleCerradas = (configuracion) =>
  configuracion?.diasVisibleCerradas === undefined ? DIAS_VISIBLE_CERRADAS : configuracion.diasVisibleCerradas;

/** Las ediciones cerradas no se muestran en el sitio público. */
export const edicionPublica = (edicion) => edicion?.estado === 'activa';

/** Una votación cerrada sigue visible los días configurados en /panel/configuracion después de su cierre (o siempre). */
export function cerradaVisible(votacion, configuracion, ahora = Date.now()) {
  const dias = diasVisibleCerradas(configuracion);
  if (dias === null) return true;
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
