// Guía del inicio del panel: pasos para preparar una edición y lo que requiere atención del administrador.
// Las mismas reglas están en el portal Django (portal/vistas/panel/inicio.py).
// Con roles delegados, `puede(codigo)` quita el enlace (to: null) de los pasos cuya sección el rol no puede ver.
import { permisoDeRuta } from '../data/permisos.js';

const OPCIONES_MINIMAS = 2;
const TODO = () => true;
const segunPermiso = (filas, puede) => filas.map((f) => (f.to && !puede(permisoDeRuta(f.to)) ? { ...f, to: null } : f));

const contar = (total, singular, plural) => `${total} ${total === 1 ? singular : plural}`;

export const opcionesActivas = (opciones, votacionId) => opciones.filter((o) => o.votacionId === votacionId && o.activa !== false).length;

export function rutaTrabajo({ edicion, categorias, votaciones, puede = TODO }) {
  const activas = categorias.filter((c) => c.activa).length;
  const publicadas = votaciones.filter((v) => v.publicada).length;
  return segunPermiso([
    { titulo: 'Edición', detalle: edicion ? edicion.nombre : 'Crea la primera', lista: !!edicion, to: '/panel/ediciones' },
    { titulo: 'Categorías', detalle: contar(activas, 'activa', 'activas'), lista: activas > 0, to: '/panel/categorias' },
    { titulo: 'Votaciones', detalle: contar(votaciones.length, 'creada', 'creadas'), lista: votaciones.length > 0, to: '/panel/votaciones' },
    { titulo: 'Opciones y publicación', detalle: `${publicadas} de ${votaciones.length} publicadas`, lista: votaciones.length > 0 && publicadas === votaciones.length, to: '/panel/votaciones' },
  ], puede);
}

export function pendientesPanel({ puede = TODO, ...datos }) {
  return segunPermiso(calcularPendientes(datos), puede);
}

function calcularPendientes({ edicion, hayActiva, categorias, votaciones, opciones }) {
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
