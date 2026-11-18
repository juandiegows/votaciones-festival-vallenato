import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { alPerderSesion, api, descargarArchivo, guardarToken, leerToken, obtener } from '../api/cliente.js';
import {
  ARCHIVOS,
  auditoriaDesdeApi,
  autoriaDesdeApi,
  desdeApi,
  erroresDesdeApi,
  haciaApi,
  integridadDesdeApi,
  participacionDesdeApi,
  registroDesdeApi,
  resultadosDesdeApi,
  resumenRegistrosDesdeApi,
  resumenDesdeApi,
  usuarioDesdeApi,
} from '../api/adaptadores.js';
import { calcularEstado } from '../utils/helpers.js';
import { AppContext, buscarEdicionActiva, crearPuede } from './contexto.js';
import { ADMINISTRADOR, GRUPOS_PERMISOS, ROLES_INICIALES, TODOS_LOS_PERMISOS } from '../data/permisos.js';
import PantallaCarga from '../components/PantallaCarga.jsx';

const RUTAS_ADMIN = {
  ediciones: '/admin/ediciones/',
  categorias: '/admin/categorias/',
  votaciones: '/admin/votaciones/',
  opciones: '/admin/opciones/',
  banners: '/admin/banners/',
  revistas: '/admin/revistas/',
  redes: '/admin/redes/',
};

const VACIO = {
  ediciones: [], categorias: [], votaciones: [], opciones: [], votos: [], usuarios: [], auditoria: [], totalAuditoria: 0,
  banners: [], revistas: [], redes: [], configuracion: null, roles: [], catalogoPermisos: GRUPOS_PERMISOS,
};

/** Permisos del usuario según la API; una API anterior a los roles solo distinguía al administrador. */
function permisosDe(u) {
  if (!u) return [];
  if (Array.isArray(u.permisos)) return u.permisos;
  return u.rol === ADMINISTRADOR ? TODOS_LOS_PERMISOS : [];
}

/**
 * Roles para elegir al asignar uno (AdminUsuarios). Sin roles.ver no llega la lista: se arma con los roles del sistema
 * y los que tienen los usuarios cargados; sus permisos no se conocen (null) y la API decide si se pueden asignar.
 */
function rolesDisponibles(roles, usuarios) {
  if (roles.length) return [...roles].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
  const lista = ROLES_INICIALES.map((r) => ({ ...r, id: r.codigo, permisos: r.codigo === ADMINISTRADOR ? TODOS_LOS_PERMISOS : null }));
  usuarios.forEach((u) => {
    if (!lista.some((r) => r.codigo === u.rol)) lista.push({ id: u.rol, codigo: u.rol, nombre: u.rolNombre || u.rol, descripcion: '', permisos: null, orden: 99 });
  });
  return lista;
}

const ACTIVOS_POR_DEFECTO = { banners: { activo: true }, revistas: { activa: true }, categorias: { activa: true }, opciones: { activa: true } };

const mapear = (coleccion, lista) => lista.map((x) => desdeApi(coleccion, x));

/**
 * Modo API: los datos vienen de Django REST (VITE_API_URL). Expone el mismo contrato que
 * MockProvider para que las pantallas funcionen igual en ambos modos.
 */
export function ApiProvider({ children }) {
  const [cargaInicial, setCargaInicial] = useState({ cargando: true, error: null });
  const [usuario, setUsuario] = useState(null);
  const [colecciones, setColecciones] = useState(VACIO);
  const [misVotos, setMisVotos] = useState([]);
  const [version, setVersion] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const usuarioRef = useRef(null);
  usuarioRef.current = usuario;

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  /**
   * Carga las colecciones que corresponden al usuario. Con acceso al panel, cada colección de administración se pide
   * solo si el rol tiene su permiso `.ver`; si no, se usa la versión pública (o queda vacía) para no recibir un 403.
   */
  const cargarColecciones = useCallback(async (u) => {
    const permisos = new Set(permisosDe(u));
    const tiene = (codigo) => permisos.has(codigo);
    // Contacto, redes, revistas y banners activos (público); con sitio.ver llegan además los inactivos
    const sitio = await obtener('/sitio/');
    let nuevas;
    if (tiene('panel.ver')) {
      // Si el rol cambió mientras la sesión estaba abierta, un 403 deja la colección vacía en lugar de romper la carga
      let rechazos = 0;
      const pedir = (codigo, ruta, vacio) => (tiene(codigo)
        ? obtener(ruta).catch((e) => {
          if (e.status !== 403) throw e;
          rechazos += 1;
          return vacio;
        })
        : Promise.resolve(vacio));
      const ediciones = (await pedir('ediciones.ver', '/admin/ediciones/', null)) || (await obtener('/ediciones/'));
      const categoriasPublicas = () => Promise.all(ediciones.map((e) => obtener(`/categorias/?edicion=${e.id}`))).then((l) => l.flat());
      const [categorias, votaciones, opciones, votos, usuarios, auditoria, banners, redes, revistas, roles, catalogo] = await Promise.all([
        pedir('categorias.ver', '/admin/categorias/', null).then((l) => l || categoriasPublicas()),
        pedir('votaciones.ver', '/admin/votaciones/', null).then((l) => l || obtener('/votaciones/')),
        pedir('opciones.ver', '/admin/opciones/', null).then((l) => l || obtener('/opciones/')),
        pedir('resultados.ver', '/admin/votos/', []),
        pedir('usuarios.ver', '/admin/usuarios/', []),
        pedir('auditoria.ver', '/admin/auditoria/', { results: [], count: 0 }),
        pedir('sitio.ver', '/admin/banners/', null),
        pedir('sitio.ver', '/admin/redes/', null),
        pedir('sitio.ver', '/admin/revistas/', null),
        pedir('roles.ver', '/admin/roles/', []),
        pedir('roles.ver', '/admin/roles/catalogo/', []),
      ]);
      if (banners) sitio.banners = banners;
      if (redes) sitio.redes = redes;
      if (revistas) sitio.revistas = revistas;
      const cats = mapear('categorias', categorias);
      const vots = mapear('votaciones', votaciones);
      const ops = mapear('opciones', opciones);
      const eds = mapear('ediciones', ediciones);
      const listas = { edicion: eds, categoria: cats, votacion: vots, opcion: ops };
      const nombrePor = (entidad, id) => {
        const x = listas[entidad]?.find((e) => e.id === id);
        return x?.titulo || x?.nombre || '';
      };
      nuevas = {
        ...VACIO,
        ediciones: eds,
        categorias: cats,
        votaciones: vots,
        opciones: ops,
        votos: mapear('votos', votos),
        usuarios: mapear('usuarios', usuarios),
        auditoria: auditoria.results.map((r) => auditoriaDesdeApi(r, nombrePor)),
        totalAuditoria: auditoria.count,
        roles: mapear('roles', roles),
        catalogoPermisos: catalogo.length ? catalogo : GRUPOS_PERMISOS,
      };
      // Permisos desactualizados: se vuelve a leer el perfil para que el menú y los botones se ajusten
      if (rechazos > 0) {
        const r = await api.get('/auth/yo/');
        if (r.ok) setUsuario(usuarioDesdeApi(r.datos));
      }
    } else {
      const ediciones = await obtener('/ediciones/');
      // Categorías activas de cada edición (para las URL /{año}/… de ediciones anteriores)
      const [porEdicion, votaciones, opciones] = await Promise.all([
        Promise.all(ediciones.map((e) => obtener(`/categorias/?edicion=${e.id}`))),
        obtener('/votaciones/'),
        obtener('/opciones/'),
      ]);
      nuevas = {
        ...VACIO,
        ediciones: mapear('ediciones', ediciones),
        categorias: mapear('categorias', porEdicion.flat()),
        votaciones: mapear('votaciones', votaciones),
        opciones: mapear('opciones', opciones),
      };
    }
    nuevas.banners = mapear('banners', sitio.banners);
    nuevas.redes = mapear('redes', sitio.redes);
    nuevas.revistas = mapear('revistas', sitio.revistas || []);
    nuevas.configuracion = desdeApi('configuracion', sitio.configuracion);
    nuevas.totalVotosSitio = sitio.total_votos ?? null;
    const mios = u ? mapear('votos', await obtener('/mis-votos/')).map((v) => ({ ...v, usuarioId: u.id })) : [];
    setColecciones(nuevas);
    setMisVotos(mios);
    setVersion((v) => v + 1);
  }, []);

  const recargar = useCallback(async () => {
    try {
      await cargarColecciones(usuarioRef.current);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [cargarColecciones]);

  // Restaura la sesión (token guardado → /auth/yo/) y carga los datos iniciales.
  const iniciar = useCallback(async () => {
    setCargaInicial({ cargando: true, error: null });
    let u = null;
    if (leerToken()) {
      const r = await api.get('/auth/yo/');
      if (r.ok) u = usuarioDesdeApi(r.datos);
      else if (r.status === 401) guardarToken(null);
      else if (r.status === 0) {
        setCargaInicial({ cargando: false, error: r.error });
        return;
      }
    }
    try {
      await cargarColecciones(u);
      setUsuario(u);
      setCargaInicial({ cargando: false, error: null });
    } catch (e) {
      setCargaInicial({ cargando: false, error: e.message });
    }
  }, [cargarColecciones]);

  useEffect(() => {
    iniciar();
  }, [iniciar]);

  // Si la API rechaza el token (expiró o se cerró en otro dispositivo), se cierra la sesión local.
  useEffect(() => {
    alPerderSesion(() => {
      guardarToken(null);
      if (usuarioRef.current) {
        setUsuario(null);
        cargarColecciones(null).catch(() => {});
      }
    });
    return () => alPerderSesion(null);
  }, [cargarColecciones]);

  const votaciones = useMemo(
    () => colecciones.votaciones.map((v) => ({ ...v, estado: calcularEstado(v, ahora) })),
    [colecciones.votaciones, ahora]
  );

  // ---------- Autenticación ----------
  const abrirSesion = async (r) => {
    guardarToken(r.datos.token);
    const u = usuarioDesdeApi(r.datos.usuario);
    try {
      await cargarColecciones(u);
    } catch {
      /* la sesión es válida aunque falle una colección; se reintenta al navegar */
    }
    setUsuario(u);
    return { ok: true, usuario: u };
  };

  const iniciarSesion = async (correo, contrasena) => {
    const r = await api.post('/auth/login/', { email: correo.trim().toLowerCase(), password: contrasena });
    if (!r.ok) return { ok: false, error: r.error };
    return abrirSesion(r);
  };

  const registrarUsuario = async (form) => {
    const r = await api.post('/auth/registro/', {
      email: form.correo.trim().toLowerCase(),
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      // El documento solo viaja si se llenó (la administración decide si es obligatorio)
      ...(form.numeroDocumento?.trim() ? { tipo_documento: form.tipoDocumento, numero_documento: form.numeroDocumento.trim() } : {}),
      password: form.contrasena,
      acepta_tratamiento_datos: form.aceptaTratamientoDatos,
    });
    if (!r.ok) {
      const errores = erroresDesdeApi('usuarios', r.errores);
      if (errores.password) errores.contrasena = errores.password;
      if (errores.acepta_tratamiento_datos) errores.aceptaTratamientoDatos = errores.acepta_tratamiento_datos;
      return { ok: false, error: r.error, errores };
    }
    return abrirSesion(r);
  };

  /** Confirma el correo con el token del enlace; si es la cuenta abierta, la marca como verificada. */
  const confirmarCorreo = async (token) => {
    const r = await api.post('/auth/confirmar-correo/', { token });
    if (!r.ok) return { ok: false, error: r.error, codigo: r.codigo };
    const confirmado = usuarioDesdeApi(r.datos);
    setUsuario((u) => (u && u.id === confirmado.id ? { ...u, correoVerificado: true } : u));
    return { ok: true, usuario: confirmado };
  };

  /** Para cuentas sin documento cuando la administración empieza a pedirlo: se registra una sola vez. */
  const completarDocumento = async (tipoDocumento, numeroDocumento) => {
    const r = await api.post('/auth/documento/', { tipo_documento: tipoDocumento, numero_documento: numeroDocumento.trim() });
    if (!r.ok) {
      const errores = erroresDesdeApi('usuarios', r.errores);
      return { ok: false, error: r.error, codigo: r.codigo, errores };
    }
    const actualizado = usuarioDesdeApi(r.datos);
    setUsuario((u) => (u ? { ...u, tipoDocumento: actualizado.tipoDocumento, numeroDocumento: actualizado.numeroDocumento } : u));
    return { ok: true };
  };

  const reenviarConfirmacion = async () => {
    const r = await api.post('/auth/reenviar-confirmacion/');
    if (!r.ok) return { ok: false, error: r.error, codigo: r.codigo };
    return { ok: true, mensaje: r.datos?.detail };
  };

  const cerrarSesion = async () => {
    await api.post('/auth/logout/');
    guardarToken(null);
    setUsuario(null);
    try {
      await cargarColecciones(null);
    } catch {
      /* sin conexión: se mantiene la vista actual */
    }
    return { ok: true };
  };

  // ---------- Votación ----------
  const votosDeUsuario = useCallback((votacionId) => misVotos.filter((v) => v.votacionId === votacionId), [misVotos]);

  const emitirVoto = async (votacionId, opcionId) => {
    const r = await api.post(`/votaciones/${votacionId}/votar/`, { opcion: opcionId });
    if (!r.ok) {
      await recargar();
      return { ok: false, error: r.error, codigo: r.codigo };
    }
    const voto = { ...desdeApi('votos', r.datos), usuarioId: usuario?.id };
    setMisVotos((l) => [...l, voto]);
    // Los totales se refrescan en segundo plano: el comprobante se muestra sin esperar la recarga completa
    recargar();
    return { ok: true, voto };
  };

  // ---------- Administración ----------
  const guardarEntidad = async (coleccion, entidad) => {
    const ruta = RUTAS_ADMIN[coleccion];
    const actual = entidad.id ? colecciones[coleccion].find((x) => x.id === entidad.id) : null;
    let cuerpo = haciaApi(coleccion, entidad);
    const ficheros = (ARCHIVOS[coleccion] || []).filter((a) => entidad[a.campo]);
    const fichero = ficheros.length > 0;
    if (fichero) {
      // Imagen del banner, ícono o audio: multipart/form-data con el archivo y los demás campos
      // En multipart, DRF toma un booleano ausente como «false»: al crear se envían los activos por defecto
      if (!entidad.id) cuerpo = { ...ACTIVOS_POR_DEFECTO[coleccion], ...cuerpo };
      const formulario = new FormData();
      // Un archivo que se quita viaja vacío (la API lo interpreta como «sin archivo»)
      const apisArchivo = new Set((ARCHIVOS[coleccion] || []).map((a) => a.api));
      Object.entries(cuerpo).forEach(([k, v]) => {
        if (v !== null) formulario.append(k, v);
        else if (apisArchivo.has(k)) formulario.append(k, '');
      });
      ficheros.forEach((a) => formulario.append(a.api, entidad[a.campo]));
      cuerpo = formulario;
    }
    let id = entidad.id;
    let guardada = actual;

    const fallo = async (r) => {
      await recargar();
      return { ok: false, error: r.error, errores: erroresDesdeApi(coleccion, r.errores) };
    };

    if (fichero || Object.keys(cuerpo).length) {
      const r = id ? await api.patch(`${ruta}${id}/`, cuerpo) : await api.post(ruta, cuerpo);
      if (!r.ok) return fallo(r);
      guardada = desdeApi(coleccion, r.datos);
      id = guardada.id;
    }

    if (coleccion === 'votaciones') {
      // Banderas que la API cambia solo mediante acciones (publicar, cerrar, publicar resultados)
      if (entidad.publicada === true && !actual?.publicada) {
        const r = await api.post(`${ruta}${id}/publicar/`);
        if (!r.ok) return fallo(r);
      }
      if (entidad.publicada === false && actual?.publicada) {
        const r = await api.post(`${ruta}${id}/despublicar/`);
        if (!r.ok) return fallo(r);
      }
      if (entidad.cerradaManualmente === true && !actual?.cerradaManualmente) {
        const r = await api.post(`${ruta}${id}/cerrar/`);
        if (!r.ok) return fallo(r);
      }
      if (entidad.resultadosPublicados !== undefined && entidad.resultadosPublicados !== !!actual?.resultadosPublicados) {
        const r = await api.post(`${ruta}${id}/publicar-resultados/`, { publicar: entidad.resultadosPublicados });
        if (!r.ok) return fallo(r);
      }
    }

    await recargar();
    return { ok: true, entidad: guardada || { ...entidad, id } };
  };

  const eliminarEntidad = async (coleccion, id) => {
    const r = await api.delete(`${RUTAS_ADMIN[coleccion]}${id}/`);
    await recargar();
    return r.ok ? { ok: true } : { ok: false, error: r.error, codigo: r.codigo };
  };

  /** Aplica una lista completa: crea los elementos nuevos y actualiza solo los campos que cambiaron. */
  const reemplazarColeccion = async (coleccion, lista) => {
    const ruta = RUTAS_ADMIN[coleccion];
    const actuales = new Map(colecciones[coleccion].map((x) => [x.id, x]));
    // Primero los que se desactivan/cierran y al final los que se activan (p. ej. la edición activa)
    const ordenada = [...lista].sort((a, b) => (a.estado === 'activa') - (b.estado === 'activa'));
    for (const item of ordenada) {
      const previo = item.id ? actuales.get(item.id) : null;
      let r = null;
      if (!previo) r = await api.post(ruta, haciaApi(coleccion, item));
      else {
        const cambios = Object.fromEntries(Object.entries(item).filter(([k, v]) => JSON.stringify(previo[k]) !== JSON.stringify(v)));
        const cuerpo = haciaApi(coleccion, cambios);
        if (Object.keys(cuerpo).length) r = await api.patch(`${ruta}${item.id}/`, cuerpo);
      }
      if (r && !r.ok) {
        await recargar();
        return { ok: false, error: r.error, errores: erroresDesdeApi(coleccion, r.errores) };
      }
    }
    await recargar();
    return { ok: true };
  };

  const publicarResultadosEdicion = async (edicionId, publicar) => {
    const r = await api.post(`/admin/ediciones/${edicionId}/publicar-resultados/`, { publicar });
    await recargar();
    return r.ok ? { ok: true, actualizadas: r.datos?.actualizadas ?? 0 } : { ok: false, error: r.error };
  };

  const guardarConfiguracion = async (datos) => {
    const r = await api.patch('/admin/configuracion/', haciaApi('configuracion', datos));
    await recargar();
    return r.ok ? { ok: true } : { ok: false, error: r.error, errores: erroresDesdeApi('configuracion', r.errores) };
  };

  // Logo del sitio (Identidad visual): multipart aparte de la configuración (sitio.editar)
  const guardarLogo = async (archivo, textoAlternativo) => {
    const formulario = new FormData();
    formulario.append('logo', archivo);
    if (textoAlternativo !== undefined) formulario.append('logo_texto_alternativo', textoAlternativo);
    const r = await api.post('/admin/configuracion/logo/', formulario);
    await recargar();
    return r.ok ? { ok: true } : { ok: false, error: r.error, errores: erroresDesdeApi('configuracion', r.errores) };
  };
  const quitarLogo = async () => {
    const r = await api.delete('/admin/configuracion/logo/');
    await recargar();
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  };

  // ---------- Resultados, exportación y auditoría ----------
  const obtenerResultados = useCallback(async (votacionId, { admin = false } = {}) => {
    const r = await api.get(admin ? `/admin/votaciones/${votacionId}/resultados/` : `/votaciones/${votacionId}/resultados/`);
    if (!r.ok) return { ok: false, status: r.status, error: r.error };
    return { ok: true, ...resultadosDesdeApi(r.datos) };
  }, []);

  // Resultados de votaciones, categorías o ediciones en pdf | excel | csv | json | sql (los archivos los genera la API)
  const EXTENSIONES = { pdf: 'pdf', excel: 'xlsx', csv: 'csv', json: 'json', sql: 'sql' };
  const exportar = async (coleccion, id, formato = 'pdf') => {
    const r = await descargarArchivo(`/admin/${coleccion}/${id}/exportar/?formato=${formato}`, `resultados-${id}.${EXTENSIONES[formato]}`);
    if (r.ok) recargar();
    return r;
  };
  const exportarResultados = (votacionId, formato) => exportar('votaciones', votacionId, formato);

  // Asignar un rol a un usuario (la API impide cambiar el propio rol y asignar roles con permisos que no se tienen)
  const cambiarRol = async (id, rol) => {
    const r = await api.post(`/admin/usuarios/${id}/rol/`, { rol });
    if (!r.ok) return { ok: false, error: r.error };
    await recargar();
    return { ok: true, usuario: usuarioDesdeApi(r.datos) };
  };

  // Roles: crear o cambiar nombre, descripción y permisos (el código solo se envía al crear)
  const guardarRol = async (rol) => {
    const cuerpo = haciaApi('roles', rol);
    if (rol.id) delete cuerpo.codigo;
    const r = rol.id ? await api.patch(`/admin/roles/${rol.id}/`, cuerpo) : await api.post('/admin/roles/', cuerpo);
    if (!r.ok) return { ok: false, error: r.error, errores: erroresDesdeApi('roles', r.errores) };
    await recargar();
    return { ok: true, rol: desdeApi('roles', r.datos) };
  };

  const eliminarRol = async (id) => {
    const r = await api.delete(`/admin/roles/${id}/`);
    if (!r.ok) return { ok: false, error: r.error, codigo: r.codigo };
    await recargar();
    return { ok: true };
  };

  // Datos de demostración (cargar_demo): resumen, eliminar y volver a cargar
  const obtenerDemo = useCallback(async () => {
    const r = await api.get('/admin/demo/');
    if (!r.ok) return { ok: false, error: r.error };
    const d = r.datos;
    return { ok: true, datos: { ediciones: d.ediciones, usuarios: d.usuarios, votos: d.votos, anios: d.anios, esCuentaDemo: d.es_cuenta_demo } };
  }, []);
  const accionDemo = async (accion) => {
    const r = await api.post(`/admin/demo/${accion}/`);
    if (!r.ok) return { ok: false, error: r.error };
    await recargar();
    return { ok: true, resultado: r.datos.resultado };
  };
  const eliminarDemo = () => accionDemo('eliminar');
  const cargarDemo = () => accionDemo('cargar');

  // Ediciones completas con la plantilla de Excel
  const descargarPlantillaEdicion = () => descargarArchivo('/admin/ediciones/plantilla/', 'plantilla-edicion.xlsx');
  const exportarEstructuraEdicion = (id) => descargarArchivo(`/admin/ediciones/${id}/exportar-estructura/`, `edicion-${id}.xlsx`);
  const importarEdicion = async (archivo, activar = false) => {
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    formulario.append('activar', activar ? 'true' : 'false');
    const r = await api.post('/admin/ediciones/importar/', formulario);
    if (!r.ok) return { ok: false, error: r.error, errores: Array.isArray(r.datos?.errores) ? r.datos.errores : [] };
    await recargar();
    return { ok: true, resumen: r.datos };
  };

  const cargarAuditoria = async (pagina = 1, filtros = {}) => {
    const params = new URLSearchParams({ page: pagina });
    Object.entries(filtros).forEach(([k, v]) => v && params.set(k, v));
    const r = await api.get(`/admin/auditoria/?${params}`);
    if (!r.ok) return { ok: false, error: r.error };
    const listas = { edicion: colecciones.ediciones, categoria: colecciones.categorias, votacion: colecciones.votaciones, opcion: colecciones.opciones };
    const nombrePor = (entidad, id) => {
      const x = listas[entidad]?.find((e) => e.id === id);
      return x?.titulo || x?.nombre || '';
    };
    return {
      ok: true,
      registros: r.datos.results.map((x) => auditoriaDesdeApi(x, nombrePor)),
      total: r.datos.count,
      hayMas: Boolean(r.datos.next),
    };
  };

  const obtenerParticipacion = useCallback(async (votacionId) => {
    const r = await api.get(`/admin/votaciones/${votacionId}/participacion/`);
    return r.ok ? { ok: true, ...participacionDesdeApi(r.datos) } : { ok: false, error: r.error };
  }, []);

  const obtenerResumen = useCallback(async (edicionId) => {
    const r = await api.get(`/admin/ediciones/${edicionId}/resumen/`);
    return r.ok ? { ok: true, ...resumenDesdeApi(r.datos) } : { ok: false, error: r.error };
  }, []);

  const obtenerIntegridad = useCallback(async (edicionId) => {
    const r = await api.get(`/admin/auditoria/integridad/?edicion=${edicionId}`);
    return r.ok ? { ok: true, ...integridadDesdeApi(r.datos) } : { ok: false, error: r.error };
  }, []);

  const obtenerAutoria = useCallback(async (edicionId) => {
    const r = await api.get(`/admin/auditoria/autoria/?edicion=${edicionId}`);
    return r.ok ? { ok: true, ...autoriaDesdeApi(r.datos) } : { ok: false, error: r.error };
  }, []);

  // Registros técnicos (registros.ver): errores del servidor y de la web, 50 por página
  const cargarRegistros = useCallback(async (pagina = 1, filtros = {}) => {
    const params = new URLSearchParams({ page: pagina });
    Object.entries(filtros).forEach(([k, v]) => v && params.set(k, v));
    const r = await api.get(`/admin/registros/?${params}`);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, registros: r.datos.results.map(registroDesdeApi), total: r.datos.count, hayMas: Boolean(r.datos.next) };
  }, []);

  const obtenerResumenRegistros = useCallback(async () => {
    const r = await api.get('/admin/registros/resumen/');
    return r.ok ? { ok: true, ...resumenRegistrosDesdeApi(r.datos) } : { ok: false, error: r.error };
  }, []);

  // La API responde 500 a propósito: lo esperado es un error con la referencia del registro creado
  const provocarErrorPrueba = useCallback(async () => {
    const r = await api.post('/admin/registros/probar/');
    if (r.status === 500 && r.referencia) return { ok: true, referencia: r.referencia, mensaje: r.error };
    return { ok: false, error: r.ok ? 'La API no devolvió el error de prueba esperado.' : r.error };
  }, []);

  if (cargaInicial.cargando || cargaInicial.error) {
    return <PantallaCarga error={cargaInicial.error} onReintentar={iniciar} />;
  }

  // eslint-disable-next-line no-unused-vars
  const { totalAuditoria, totalVotosSitio, roles, ...datos } = colecciones;
  const permisos = permisosDe(usuario);
  const puede = crearPuede(permisos);
  const valor = {
    modo: 'api',
    ...datos,
    totalAuditoria,
    votaciones,
    misVotos,
    // Lo mismo que ve el público: nulo salvo que Configuración permita mostrar el total
    totalVotos: colecciones.totalVotosSitio ?? null,
    publicarResultadosEdicion,
    usuario,
    permisos,
    puede,
    // «Accede al panel»: cualquier rol con panel.ver (no solo el administrador)
    esAdmin: puede('panel.ver'),
    roles: rolesDisponibles(roles, colecciones.usuarios),
    edicionActiva: buscarEdicionActiva(colecciones.ediciones),
    version,
    iniciarSesion,
    cerrarSesion,
    registrarUsuario,
    confirmarCorreo,
    reenviarConfirmacion,
    completarDocumento,
    votosDeUsuario,
    emitirVoto,
    guardarEntidad,
    eliminarEntidad,
    reemplazarColeccion,
    guardarConfiguracion,
    guardarLogo,
    quitarLogo,
    obtenerResultados,
    exportarResultados,
    exportar,
    obtenerDemo,
    cambiarRol,
    guardarRol,
    eliminarRol,
    eliminarDemo,
    cargarDemo,
    descargarPlantillaEdicion,
    exportarEstructuraEdicion,
    importarEdicion,
    cargarAuditoria,
    obtenerParticipacion,
    obtenerResumen,
    obtenerIntegridad,
    obtenerAutoria,
    cargarRegistros,
    obtenerResumenRegistros,
    provocarErrorPrueba,
    recargar,
    restablecer: null,
  };

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}
