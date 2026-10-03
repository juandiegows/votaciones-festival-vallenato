import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { alPerderSesion, api, descargarArchivo, guardarToken, leerToken, obtener } from '../api/cliente.js';
import {
  ARCHIVOS,
  auditoriaDesdeApi,
  desdeApi,
  erroresDesdeApi,
  haciaApi,
  integridadDesdeApi,
  participacionDesdeApi,
  resultadosDesdeApi,
  resumenDesdeApi,
  usuarioDesdeApi,
} from '../api/adaptadores.js';
import { calcularEstado } from '../utils/helpers.js';
import { AppContext, buscarEdicionActiva } from './contexto.js';
import PantallaCarga from '../components/PantallaCarga.jsx';

const RUTAS_ADMIN = {
  ediciones: '/admin/ediciones/',
  categorias: '/admin/categorias/',
  votaciones: '/admin/votaciones/',
  opciones: '/admin/opciones/',
  banners: '/admin/banners/',
  redes: '/admin/redes/',
};

const VACIO = {
  ediciones: [], categorias: [], votaciones: [], opciones: [], votos: [], usuarios: [], auditoria: [], totalAuditoria: 0,
  banners: [], redes: [], configuracion: null,
};

const ACTIVOS_POR_DEFECTO = { banners: { activo: true }, categorias: { activa: true }, opciones: { activa: true } };

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

  /** Carga las colecciones que corresponden al usuario (público, votante o administrador). */
  const cargarColecciones = useCallback(async (u) => {
    const esAdmin = u?.rol === 'administrador';
    // Contacto, redes y banners activos (público); el administrador recibe además los inactivos
    const sitio = await obtener('/sitio/');
    let nuevas;
    if (esAdmin) {
      const [ediciones, categorias, votaciones, opciones, votos, usuarios, auditoria, banners, redes] = await Promise.all([
        obtener('/admin/ediciones/'),
        obtener('/admin/categorias/'),
        obtener('/admin/votaciones/'),
        obtener('/admin/opciones/'),
        obtener('/admin/votos/'),
        obtener('/admin/usuarios/'),
        obtener('/admin/auditoria/'),
        obtener('/admin/banners/'),
        obtener('/admin/redes/'),
      ]);
      sitio.banners = banners;
      sitio.redes = redes;
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
        ediciones: eds,
        categorias: cats,
        votaciones: vots,
        opciones: ops,
        votos: mapear('votos', votos),
        usuarios: mapear('usuarios', usuarios),
        auditoria: auditoria.results.map((r) => auditoriaDesdeApi(r, nombrePor)),
        totalAuditoria: auditoria.count,
      };
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
    nuevas.configuracion = desdeApi('configuracion', sitio.configuracion);
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
    await recargar();
    return { ok: true, voto };
  };

  // ---------- Administración ----------
  const guardarEntidad = async (coleccion, entidad) => {
    const ruta = RUTAS_ADMIN[coleccion];
    const actual = entidad.id ? colecciones[coleccion].find((x) => x.id === entidad.id) : null;
    let cuerpo = haciaApi(coleccion, entidad);
    const archivo = ARCHIVOS[coleccion];
    const fichero = archivo && entidad[archivo.campo];
    if (fichero) {
      // Imagen del banner, ícono o audio: multipart/form-data con el archivo y los demás campos
      // En multipart, DRF toma un booleano ausente como «false»: al crear se envían los activos por defecto
      if (!entidad.id) cuerpo = { ...ACTIVOS_POR_DEFECTO[coleccion], ...cuerpo };
      const formulario = new FormData();
      Object.entries(cuerpo).forEach(([k, v]) => v !== null && formulario.append(k, v));
      formulario.append(archivo.api, fichero);
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

  const guardarConfiguracion = async (datos) => {
    const r = await api.patch('/admin/configuracion/', haciaApi('configuracion', datos));
    await recargar();
    return r.ok ? { ok: true } : { ok: false, error: r.error, errores: erroresDesdeApi('configuracion', r.errores) };
  };

  // ---------- Resultados, exportación y auditoría ----------
  const obtenerResultados = useCallback(async (votacionId, { admin = false } = {}) => {
    const r = await api.get(admin ? `/admin/votaciones/${votacionId}/resultados/` : `/votaciones/${votacionId}/resultados/`);
    if (!r.ok) return { ok: false, status: r.status, error: r.error };
    return { ok: true, ...resultadosDesdeApi(r.datos) };
  }, []);

  const exportarResultadosCSV = async (votacionId) => {
    const r = await descargarArchivo(`/admin/votaciones/${votacionId}/resultados/csv/`, `resultados-votacion-${votacionId}.csv`);
    if (r.ok) recargar();
    return r;
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

  if (cargaInicial.cargando || cargaInicial.error) {
    return <PantallaCarga error={cargaInicial.error} onReintentar={iniciar} />;
  }

  const { totalAuditoria, ...datos } = colecciones;
  const esAdmin = usuario?.rol === 'administrador';
  const valor = {
    modo: 'api',
    ...datos,
    totalAuditoria,
    votaciones,
    misVotos,
    totalVotos: esAdmin ? colecciones.votos.length : null,
    usuario,
    esAdmin,
    edicionActiva: buscarEdicionActiva(colecciones.ediciones),
    version,
    iniciarSesion,
    cerrarSesion,
    registrarUsuario,
    votosDeUsuario,
    emitirVoto,
    guardarEntidad,
    eliminarEntidad,
    reemplazarColeccion,
    guardarConfiguracion,
    obtenerResultados,
    exportarResultadosCSV,
    cargarAuditoria,
    obtenerParticipacion,
    obtenerResumen,
    obtenerIntegridad,
    recargar,
    restablecer: null,
  };

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}
