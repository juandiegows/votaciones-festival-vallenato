import { API_URL } from '../config.js';

// Adaptadores entre la API (snake_case) y el modelo de la web (camelCase, igual al modo demostración).
// Es el ÚNICO lugar donde se traducen nombres de campos y valores.

const VISIBILIDAD_DESDE_API = { tiempo_real: 'en tiempo real', al_cierre: 'al cerrar', no_publicar: 'no publicar' };
const VISIBILIDAD_HACIA_API = Object.fromEntries(Object.entries(VISIBILIDAD_DESDE_API).map(([k, v]) => [v, k]));

// La votación guarda su ícono ilustrativo (Bootstrap Icons) como URL en el campo `imagen`.
const URL_ICONO = 'https://icons.getbootstrap.com/icons/';
const iconoDesdeUrl = (url) => (url && url.startsWith(URL_ICONO) ? url.slice(URL_ICONO.length).replace(/\/+$/, '') : '');
const urlDesdeIcono = (icono) => (icono ? (/^https?:\/\//.test(icono) ? icono : `${URL_ICONO}${icono}/`) : '');

// camelCase (web) → snake_case (API), por colección
const CAMPOS = {
  ediciones: { id: 'id', nombre: 'nombre', anio: 'anio', fechaInicio: 'fecha_inicio', fechaFin: 'fecha_fin', estado: 'estado' },
  categorias: {
    id: 'id', edicionId: 'edicion', edicionAnio: 'edicion_anio', nombre: 'nombre', slug: 'slug', descripcion: 'descripcion',
    icono: 'icono', activa: 'activa', orden: 'orden',
  },
  votaciones: {
    id: 'id', categoriaId: 'categoria', categoriaSlug: 'categoria_slug', edicionAnio: 'edicion_anio', titulo: 'titulo',
    slug: 'slug', descripcion: 'descripcion', imagen: 'imagen', fechaApertura: 'fecha_apertura', fechaCierre: 'fecha_cierre',
    votosPorUsuario: 'votos_por_usuario', mostrarResultados: 'visibilidad_resultados', estadoApi: 'estado',
    publicada: 'publicada', cerradaManualmente: 'cerrada_manualmente', resultadosPublicados: 'resultados_publicados',
  },
  opciones: {
    id: 'id', votacionId: 'votacion', nombre: 'nombre', descripcion: 'descripcion', imagen: 'imagen',
    enlaceMultimedia: 'enlace_multimedia', orden: 'orden', activa: 'activa',
  },
  votos: {
    id: 'id', votacionId: 'votacion', opcionId: 'opcion', fechaHora: 'fecha_hora', codigoComprobante: 'codigo_comprobante',
    votacionTitulo: 'votacion_titulo', votacionSlug: 'votacion_slug', categoriaSlug: 'categoria_slug',
    edicionAnio: 'edicion_anio', opcionNombre: 'opcion_nombre',
  },
  banners: {
    id: 'id', titulo: 'titulo', subtitulo: 'subtitulo', imagen: 'imagen', textoAlternativo: 'texto_alternativo',
    textoBoton: 'texto_boton', enlaceBoton: 'enlace_boton', orden: 'orden', activo: 'activo',
  },
  redes: { id: 'id', nombre: 'nombre', url: 'url', icono: 'icono', orden: 'orden', activa: 'activa' },
  configuracion: {
    nombreOrganizacion: 'nombre_organizacion', telefono: 'telefono', direccion: 'direccion', correo: 'correo', textoPie: 'texto_pie',
  },
  usuarios: {
    id: 'id', correo: 'email', nombres: 'nombres', apellidos: 'apellidos', rol: 'rol', activo: 'is_active',
    fechaRegistro: 'fecha_registro',
  },
};

// Campos que la API calcula o que solo cambian con acciones específicas (publicar, cerrar…)
const SOLO_LECTURA = new Set(['id', 'edicionAnio', 'categoriaSlug', 'estadoApi', 'publicada', 'cerradaManualmente', 'resultadosPublicados']);

/** Objeto de la API → objeto de la web */
export function desdeApi(coleccion, objeto) {
  const mapa = CAMPOS[coleccion];
  const salida = {};
  Object.entries(mapa).forEach(([camel, snake]) => {
    if (objeto[snake] !== undefined) salida[camel] = objeto[snake];
  });
  if (coleccion === 'votaciones') {
    salida.mostrarResultados = VISIBILIDAD_DESDE_API[objeto.visibilidad_resultados] || 'al cerrar';
    salida.imagen = iconoDesdeUrl(objeto.imagen);
    // Los listados públicos solo traen votaciones publicadas y no exponen las banderas internas.
    if (salida.publicada === undefined) salida.publicada = true;
    if (salida.cerradaManualmente === undefined) {
      salida.cerradaManualmente = objeto.estado === 'cerrada' && Date.now() < new Date(objeto.fecha_cierre).getTime();
    }
    if (salida.resultadosPublicados === undefined) salida.resultadosPublicados = false;
  }
  // Las imágenes subidas (/media/…) las sirve la API: si está en otro origen, se antepone ese origen.
  if (coleccion === 'banners' && salida.imagen?.startsWith('/') && /^https?:\/\//.test(API_URL)) {
    salida.imagen = new URL(API_URL).origin + salida.imagen;
  }
  return salida;
}

/** Objeto (o parte) de la web → cuerpo para la API; solo incluye los campos editables presentes. */
export function haciaApi(coleccion, objeto) {
  const mapa = CAMPOS[coleccion];
  const salida = {};
  Object.entries(objeto).forEach(([camel, valor]) => {
    if (SOLO_LECTURA.has(camel) || !mapa[camel] || valor === undefined) return;
    salida[mapa[camel]] = valor;
  });
  if (coleccion === 'votaciones') {
    if (objeto.mostrarResultados !== undefined) salida.visibilidad_resultados = VISIBILIDAD_HACIA_API[objeto.mostrarResultados] || 'al_cierre';
    if (objeto.imagen !== undefined) salida.imagen = urlDesdeIcono(objeto.imagen);
  }
  if (coleccion === 'banners') delete salida.imagen; // la imagen solo se envía como archivo (multipart)
  return salida;
}

/** Errores por campo de la API (snake_case) → nombres de campo de la web */
export function erroresDesdeApi(coleccion, errores = {}) {
  const inverso = Object.fromEntries(Object.entries(CAMPOS[coleccion] || {}).map(([camel, snake]) => [snake, camel]));
  return Object.fromEntries(Object.entries(errores).map(([campo, msg]) => [inverso[campo] || campo, msg]));
}

export function usuarioDesdeApi(u) {
  return u ? desdeApi('usuarios', u) : null;
}

/** Resultado de /resultados/ → filas que dibuja ResultadosChart */
export function resultadosDesdeApi(datos) {
  const total = datos.total_votos;
  const filas = datos.resultados.map((f, i) => ({ id: f.opcion_id, nombre: f.opcion, cantidad: f.votos, porcentaje: f.porcentaje, orden: i }));
  const max = filas.length ? Math.max(...filas.map((f) => f.cantidad)) : 0;
  return { total, filas: filas.map((f) => ({ ...f, ganador: total > 0 && f.cantidad === max })) };
}

const VERBOS = {
  crear: 'Creó',
  actualizar: 'Actualizó',
  eliminar: 'Eliminó',
  publicar: 'Publicó',
  cerrar: 'Cerró',
  exportar_resultados: 'Exportó los resultados de',
};
const ENTIDADES = {
  edicion: 'la edición', categoria: 'la categoría', votacion: 'la votación', opcion: 'la opción', banner: 'el banner',
  red_social: 'la red social', configuracion: 'los datos de contacto',
};

/**
 * Registro de auditoría de la API → { id, fechaHora, usuario, accion } legible.
 * `nombrePor(entidad, id)` busca el nombre actual cuando el detalle no lo trae.
 */
export function auditoriaDesdeApi(r, nombrePor = () => '') {
  const detalle = r.detalle || {};
  const nombre = detalle.titulo || detalle.nombre || detalle.nombre_organizacion || nombrePor(r.entidad, Number(r.entidad_id)) || `#${r.entidad_id}`;
  let verbo = VERBOS[r.accion] || r.accion;
  if (r.accion === 'publicar_resultados') verbo = detalle.publicar ? 'Publicó los resultados de' : 'Retiró los resultados de';
  const entidad = ENTIDADES[r.entidad] || r.entidad;
  return {
    id: r.id,
    fechaHora: r.fecha_hora,
    usuario: r.usuario || 'sistema',
    accion: `${verbo} ${entidad} «${nombre}»`,
  };
}
