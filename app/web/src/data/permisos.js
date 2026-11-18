/**
 * Catálogo de permisos y roles del sistema: copia de `app/api/votaciones/cuentas/permisos.py`.
 * Cada funcionalidad del panel es un permiso «modulo.accion»; un rol es un conjunto de permisos.
 * El modo API usa el catálogo que devuelve /api/gestion/roles/catalogo/; este sirve al modo
 * demostración y como respaldo. Si cambia en la API, cámbialo también aquí.
 */
export const GRUPOS_PERMISOS = [
  { grupo: 'Panel', permisos: [
    { codigo: 'panel.ver', descripcion: 'Entrar al panel y ver el inicio' },
  ] },
  { grupo: 'Ediciones', permisos: [
    { codigo: 'ediciones.ver', descripcion: 'Ver ediciones' },
    { codigo: 'ediciones.crear', descripcion: 'Crear ediciones' },
    { codigo: 'ediciones.editar', descripcion: 'Editar ediciones' },
    { codigo: 'ediciones.eliminar', descripcion: 'Eliminar ediciones' },
    { codigo: 'ediciones.importar', descripcion: 'Importar una edición desde Excel' },
    { codigo: 'ediciones.exportar', descripcion: 'Descargar la plantilla y la estructura de una edición' },
  ] },
  { grupo: 'Categorías', permisos: [
    { codigo: 'categorias.ver', descripcion: 'Ver categorías' },
    { codigo: 'categorias.crear', descripcion: 'Crear categorías' },
    { codigo: 'categorias.editar', descripcion: 'Editar, activar y desactivar categorías' },
    { codigo: 'categorias.eliminar', descripcion: 'Eliminar categorías' },
  ] },
  { grupo: 'Votaciones', permisos: [
    { codigo: 'votaciones.ver', descripcion: 'Ver votaciones' },
    { codigo: 'votaciones.crear', descripcion: 'Crear votaciones' },
    { codigo: 'votaciones.editar', descripcion: 'Editar votaciones' },
    { codigo: 'votaciones.eliminar', descripcion: 'Eliminar votaciones' },
    { codigo: 'votaciones.publicar', descripcion: 'Publicar, despublicar y cerrar votaciones' },
  ] },
  { grupo: 'Opciones', permisos: [
    { codigo: 'opciones.ver', descripcion: 'Ver las opciones de una votación' },
    { codigo: 'opciones.crear', descripcion: 'Crear opciones' },
    { codigo: 'opciones.editar', descripcion: 'Editar, activar y desactivar opciones' },
    { codigo: 'opciones.eliminar', descripcion: 'Eliminar opciones' },
  ] },
  { grupo: 'Votos y resultados', permisos: [
    { codigo: 'resultados.ver', descripcion: 'Ver votos, resultados y participación' },
    { codigo: 'resultados.publicar', descripcion: 'Publicar u ocultar resultados' },
    { codigo: 'resultados.exportar', descripcion: 'Exportar resultados (PDF, Excel, CSV, JSON o SQL)' },
  ] },
  { grupo: 'Auditoría', permisos: [
    { codigo: 'auditoria.ver', descripcion: 'Ver la auditoría, la integridad de los votos y la autoría' },
  ] },
  { grupo: 'Sitio público', permisos: [
    { codigo: 'sitio.ver', descripcion: 'Ver banners, revistas, contacto, redes e identidad visual' },
    { codigo: 'sitio.editar', descripcion: 'Cambiar banners, revistas, contacto, redes e identidad visual' },
  ] },
  { grupo: 'Configuración', permisos: [
    { codigo: 'configuracion.ver', descripcion: 'Ver la configuración del sistema' },
    { codigo: 'configuracion.editar', descripcion: 'Cambiar la configuración del sistema' },
    { codigo: 'configuracion.demo', descripcion: 'Eliminar o volver a cargar los datos de demostración' },
  ] },
  { grupo: 'Usuarios', permisos: [
    { codigo: 'usuarios.ver', descripcion: 'Ver los usuarios registrados' },
    { codigo: 'usuarios.cambiar_rol', descripcion: 'Cambiar el rol de un usuario' },
  ] },
  { grupo: 'Roles y permisos', permisos: [
    { codigo: 'roles.ver', descripcion: 'Ver los roles y sus permisos' },
    { codigo: 'roles.gestionar', descripcion: 'Crear, editar y eliminar roles y cambiar sus permisos' },
  ] },
  { grupo: 'Sistema', permisos: [
    { codigo: 'registros.ver', descripcion: 'Ver los registros técnicos: errores del servidor y de la web, con su traza' },
    { codigo: 'django_admin.acceder', descripcion: 'Entrar a Django Admin' },
  ] },
];

export const DESCRIPCION_PERMISO = Object.fromEntries(GRUPOS_PERMISOS.flatMap((g) => g.permisos.map((p) => [p.codigo, p.descripcion])));
export const TODOS_LOS_PERMISOS = Object.keys(DESCRIPCION_PERMISO).sort();

export const VOTANTE = 'votante';
export const ADMINISTRADOR = 'administrador';
// Sus permisos no se editan: el votante no administra y el administrador siempre lo tiene todo
export const ROLES_FIJOS = [VOTANTE, ADMINISTRADOR];

const ESCRITURA_CONTENIDO = ['ediciones.', 'categorias.', 'votaciones.', 'opciones.'];

export const ROLES_INICIALES = [
  { codigo: VOTANTE, nombre: 'Votante', orden: 1, descripcion: 'Se registra en el sitio y vota. No entra al panel.', permisos: [] },
  {
    codigo: 'lectura', nombre: 'Solo lectura', orden: 2, descripcion: 'Consulta todo el panel sin cambiar nada.',
    // Los registros técnicos (trazas, IP) quedan para el administrador; se pueden dar desde Roles y permisos
    permisos: TODOS_LOS_PERMISOS.filter((c) => (c.endsWith('.ver') && c !== 'registros.ver') || c === 'ediciones.exportar' || c === 'resultados.exportar'),
  },
  {
    codigo: 'editor', nombre: 'Lectura y escritura', orden: 3, descripcion: 'Lee y escribe solo ediciones, categorías, votaciones y sus opciones.',
    permisos: TODOS_LOS_PERMISOS.filter((c) => c === 'panel.ver' || ESCRITURA_CONTENIDO.some((p) => c.startsWith(p))),
  },
  { codigo: ADMINISTRADOR, nombre: 'Administrador', orden: 4, descripcion: 'Acceso total: además cambia roles, usuarios y permisos.', permisos: TODOS_LOS_PERMISOS },
];

/** Permisos efectivos de un rol: el administrador lo tiene todo y el votante nada (como `Rol.permisos_efectivos`). */
export function permisosEfectivos(rol) {
  if (!rol) return [];
  if (rol.codigo === ADMINISTRADOR) return TODOS_LOS_PERMISOS;
  if (rol.codigo === VOTANTE) return [];
  return [...new Set(rol.permisos || [])].filter((c) => DESCRIPCION_PERMISO[c]).sort();
}

/** Permiso `.ver` que exige cada sección del panel (para las rutas, el menú y los enlaces). */
export const PERMISO_SECCION = {
  '/panel': 'panel.ver',
  '/panel/ediciones': 'ediciones.ver',
  '/panel/categorias': 'categorias.ver',
  '/panel/votaciones': 'votaciones.ver',
  '/panel/resultados': 'resultados.ver',
  '/panel/auditoria': 'auditoria.ver',
  '/panel/usuarios': 'usuarios.ver',
  '/panel/roles': 'roles.ver',
  '/panel/banner': 'sitio.ver',
  '/panel/revista': 'sitio.ver',
  '/panel/sitio': 'sitio.ver',
  '/panel/marca': 'sitio.ver',
  '/panel/configuracion': 'configuracion.ver',
  '/panel/registros': 'registros.ver',
};

/** Permiso que exige una ruta del panel (las opciones de una votación, `opciones.ver`). */
export function permisoDeRuta(ruta) {
  if (/^\/panel\/votaciones\/\d+\/opciones/.test(ruta)) return 'opciones.ver';
  const base = Object.keys(PERMISO_SECCION).filter((r) => ruta === r || ruta.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0];
  return PERMISO_SECCION[base] || 'panel.ver';
}
