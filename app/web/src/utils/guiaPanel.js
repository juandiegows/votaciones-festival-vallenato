// Guía del inicio del panel: pasos para preparar una edición y lo que requiere atención del administrador.
// Las mismas reglas están en el portal Django (portal/vistas/panel/inicio.py).
const OPCIONES_MINIMAS = 2;

const contar = (total, singular, plural) => `${total} ${total === 1 ? singular : plural}`;

export const opcionesActivas = (opciones, votacionId) => opciones.filter((o) => o.votacionId === votacionId && o.activa !== false).length;

export function rutaTrabajo({ edicion, categorias, votaciones }) {
  const activas = categorias.filter((c) => c.activa).length;
  const publicadas = votaciones.filter((v) => v.publicada).length;
  return [
    { titulo: 'Edición', detalle: edicion ? edicion.nombre : 'Crea la primera', lista: !!edicion, to: '/panel/ediciones' },
    { titulo: 'Categorías', detalle: contar(activas, 'activa', 'activas'), lista: activas > 0, to: '/panel/categorias' },
    { titulo: 'Votaciones', detalle: contar(votaciones.length, 'creada', 'creadas'), lista: votaciones.length > 0, to: '/panel/votaciones' },
    { titulo: 'Opciones y publicación', detalle: `${publicadas} de ${votaciones.length} publicadas`, lista: votaciones.length > 0 && publicadas === votaciones.length, to: '/panel/votaciones' },
  ];
}

export function pendientesPanel({ edicion, hayActiva, categorias, votaciones, opciones }) {
  if (!edicion) return [{ clave: 'sin-edicion', icono: 'calendar-plus', texto: 'Aún no hay ediciones registradas.', accion: 'Crear edición', to: '/panel/ediciones' }];
  const filas = [];
  if (!hayActiva) filas.push({ clave: 'sin-activa', icono: 'exclamation-triangle', texto: 'Ninguna edición está activa: el público no ve votaciones.', accion: 'Activar una edición', to: '/panel/ediciones' });
  if (edicion.estado !== 'activa') return filas; // Una edición cerrada solo se consulta
  if (edicion.votacionesPausadas) filas.push({ clave: 'pausa', icono: 'pause-circle', texto: 'La recepción de votos está en pausa: nadie puede votar.', accion: 'Revisar la pausa', to: '/panel/configuracion' });
  const sinVotaciones = [...categorias]
    .sort((a, b) => a.orden - b.orden)
    .filter((c) => c.activa && !votaciones.some((v) => v.categoriaId === c.id))
    .map((c) => c.nombre);
  if (sinVotaciones.length) filas.push({ clave: 'sin-votaciones', icono: 'grid', texto: `Categorías sin votaciones: ${sinVotaciones.join(', ')}.`, accion: 'Crear votación', to: '/panel/votaciones' });
  votaciones.filter((v) => !v.publicada).forEach((v) => {
    const faltan = OPCIONES_MINIMAS - opcionesActivas(opciones, v.id);
    const to = `/panel/votaciones/${v.id}/opciones`;
    if (faltan > 0) filas.push({ clave: `opciones-${v.id}`, icono: 'list-ol', texto: `«${v.titulo}» necesita ${contar(faltan, 'opción más', 'opciones más')} para publicarse.`, accion: 'Agregar opciones', to });
    else filas.push({ clave: `publicar-${v.id}`, icono: 'megaphone', texto: `«${v.titulo}» está lista para publicarse.`, accion: 'Revisar y publicar', to });
  });
  return filas;
}
