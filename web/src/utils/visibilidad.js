// Reglas de visibilidad pública (RN-01: votación → categoría activa → edición activa)
export function votacionesPublicas({ votaciones, categorias, edicionActiva }) {
  const categoriasVisibles = new Set(
    categorias.filter((c) => c.activa && c.edicionId === edicionActiva?.id).map((c) => c.id)
  );
  return votaciones.filter((v) => v.publicada && categoriasVisibles.has(v.categoriaId));
}
