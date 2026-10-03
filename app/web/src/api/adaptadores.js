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
  ediciones: {
    id: 'id', nombre: 'nombre', anio: 'anio', fechaInicio: 'fecha_inicio', fechaFin: 'fecha_fin', estado: 'estado',
    presentacionCategorias: 'presentacion_categorias',
  },
  categorias: {
    id: 'id', edicionId: 'edicion', edicionAnio: 'edicion_anio', nombre: 'nombre', slug: 'slug', descripcion: 'descripcion',
    icono: 'icono', iconoImagen: 'icono_imagen', activa: 'activa', orden: 'orden',
  },
  votaciones: {
    id: 'id', categoriaId: 'categoria', categoriaSlug: 'categoria_slug', edicionAnio: 'edicion_anio', titulo: 'titulo',
    slug: 'slug', descripcion: 'descripcion', imagen: 'imagen', fechaApertura: 'fecha_apertura', fechaCierre: 'fecha_cierre',
    votosPorUsuario: 'votos_por_usuario', mostrarResultados: 'visibilidad_resultados', estadoApi: 'estado',
    publicada: 'publicada', cerradaManualmente: 'cerrada_manualmente', resultadosPublicados: 'resultados_publicados',
    iconoImagen: 'icono_imagen', presentacionOpciones: 'presentacion_opciones',
  },
  opciones: {
    id: 'id', votacionId: 'votacion', nombre: 'nombre', descripcion: 'descripcion', imagen: 'imagen',
    enlaceMultimedia: 'enlace_multimedia', audio: 'audio', textoAudio: 'texto_audio', orden: 'orden', activa: 'activa',
  },
  votos: {
    id: 'id', votacionId: 'votacion', opcionId: 'opcion', fechaHora: 'fecha_hora', codigoComprobante: 'codigo_comprobante',
    votacionTitulo: 'votacion_titulo', votacionSlug: 'votacion_slug', categoriaSlug: 'categoria_slug',
    edicionAnio: 'edicion_anio', opcionNombre: 'opcion_nombre',
  },
  banners: {
    id: 'id', edicionId: 'edicion', titulo: 'titulo', subtitulo: 'subtitulo', imagen: 'imagen', textoAlternativo: 'texto_alternativo',
    textoBoton: 'texto_boton', enlaceBoton: 'enlace_boton', orden: 'orden', activo: 'activo',
  },
  redes: { id: 'id', nombre: 'nombre', url: 'url', icono: 'icono', orden: 'orden', activa: 'activa' },
  configuracion: {
    nombreOrganizacion: 'nombre_organizacion', telefono: 'telefono', direccion: 'direccion', correo: 'correo', textoPie: 'texto_pie',
    modoBanner: 'modo_banner',
  },
  usuarios: {
    id: 'id', correo: 'email', nombres: 'nombres', apellidos: 'apellidos', rol: 'rol', activo: 'is_active',
    fechaRegistro: 'fecha_registro',
  },
};

// Campos que la API calcula o que solo cambian con acciones específicas (publicar, cerrar…)
const SOLO_LECTURA = new Set(['id', 'edicionAnio', 'categoriaSlug', 'estadoApi', 'publicada', 'cerradaManualmente', 'resultadosPublicados']);

// Archivos subidos: solo viajan como multipart; la web los recibe como ruta /media/…
export const ARCHIVOS = {
  banners: { campo: 'archivo', api: 'imagen', web: 'imagen' },
  categorias: { campo: 'archivoIcono', api: 'icono_imagen', web: 'iconoImagen', quitar: 'quitarIcono' },
  votaciones: { campo: 'archivoIcono', api: 'icono_imagen', web: 'iconoImagen', quitar: 'quitarIcono' },
  opciones: { campo: 'archivoAudio', api: 'audio', web: 'audio', quitar: 'quitarAudio' },
};

/** Las rutas /media/… las sirve la API: si está en otro origen, se antepone ese origen. */
export function urlMedia(ruta) {
  if (!ruta) return '';
  if (ruta.startsWith('/') && /^https?:\/\//.test(API_URL)) return new URL(API_URL).origin + ruta;
  return ruta;
}

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
  const archivo = ARCHIVOS[coleccion];
  if (archivo) salida[archivo.web] = urlMedia(salida[archivo.web]);
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
  const archivo = ARCHIVOS[coleccion];
  if (archivo) {
    delete salida[archivo.api]; // el archivo solo se envía como multipart
    if (archivo.quitar && objeto[archivo.quitar]) salida[archivo.api] = null;
  }
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
  despublicar: 'Despublicó',
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
    tipo: r.accion,
    entidad: r.entidad,
    ip: r.ip || '',
  };
}

/** /admin/votaciones/{id}/participacion/ → quién votó (nunca por qué opción) */
export function participacionDesdeApi(d) {
  return {
    votacionId: d.votacion_id,
    estado: d.estado,
    umbral: d.umbral,
    totalVotos: d.total_votos,
    totalVotantes: d.total_votantes,
    disponible: d.disponible,
    motivo: d.motivo || '',
    ocultos: d.ocultos || 0,
    votantes: (d.votantes || []).map((v) => ({
      id: v.usuario_id,
      nombre: `${v.nombres} ${v.apellidos}`.trim(),
      correo: v.email,
      fecha: v.fecha,
    })),
  };
}

/** /admin/ediciones/{id}/resumen/ → categorías › votaciones › opciones con sus votos */
export function resumenDesdeApi(d) {
  return {
    edicionId: d.edicion_id,
    totalVotos: d.total_votos,
    categorias: d.categorias.map((c) => ({
      id: c.categoria_id,
      nombre: c.nombre,
      icono: c.icono,
      iconoImagen: urlMedia(c.icono_imagen),
      totalVotos: c.total_votos,
      votaciones: c.votaciones.map((v) => ({
        id: v.votacion_id,
        titulo: v.titulo,
        estado: v.estado,
        publicada: v.publicada,
        totalVotos: v.total_votos,
        opciones: v.opciones.map((o) => ({ id: o.opcion_id, nombre: o.nombre, votos: o.votos, porcentaje: o.porcentaje })),
      })),
    })),
  };
}

/** /admin/auditoria/integridad/ → verificaciones por votación */
export function integridadDesdeApi(d) {
  return {
    edicionId: d.edicion_id,
    generado: d.generado,
    ok: d.ok,
    resumen: {
      totalVotos: d.resumen.total_votos,
      votantesUnicos: d.resumen.votantes_unicos,
      votaciones: d.resumen.votaciones,
      conAlertas: d.resumen.votaciones_con_alertas,
    },
    votaciones: d.votaciones.map((v) => ({
      id: v.votacion_id,
      titulo: v.titulo,
      categoria: v.categoria,
      estado: v.estado,
      votosPorUsuario: v.votos_por_usuario,
      totalVotos: v.total_votos,
      sumaPorOpcion: v.suma_por_opcion,
      votantesUnicos: v.votantes_unicos,
      usuariosExcedidos: v.usuarios_excedidos,
      votosOpcionAjena: v.votos_opcion_ajena,
      votosInactivos: v.votos_inactivos,
      votosFueraDePlazo: v.votos_fuera_de_plazo,
      comprobantesDuplicados: v.comprobantes_duplicados,
      ok: v.ok,
      alertas: v.alertas || [],
    })),
  };
}
