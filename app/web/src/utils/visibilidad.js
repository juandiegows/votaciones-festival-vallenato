// Reglas de visibilidad pública (votación → categoría activa → edición indicada; por defecto, la activa)
export function votacionesPublicas({ votaciones, categorias, edicionActiva }, edicion = edicionActiva) {
  const categoriasVisibles = new Set(
    categorias.filter((c) => c.activa && c.edicionId === edicion?.id).map((c) => c.id)
  );
  return votaciones.filter((v) => v.publicada && categoriasVisibles.has(v.categoriaId));
}
