import { useCallback, useEffect, useMemo, useState } from 'react';
import { cargarDatos, cargarSesion, guardarDatos, guardarSesion, restablecerDatos } from '../data/storage.js';
import {
  calcularEstado,
  calcularResultados,
  descargarCSV,
  formatearFechaHora,
  generarCodigoComprobante,
  resultadosVisibles,
  siguienteId,
  slugUnico,
} from '../utils/helpers.js';
import { AppContext, buscarEdicionActiva } from './contexto.js';

const POR_PAGINA_AUDITORIA = 50;

/**
 * Modo demostración: simula la capa de datos y autenticación en localStorage
 * (GitHub Pages). Expone el mismo contrato que ApiProvider; las acciones son asíncronas.
 */
export function MockProvider({ children }) {
  const [datos, setDatos] = useState(cargarDatos);
  const [usuarioId, setUsuarioId] = useState(cargarSesion);
  const [ahora, setAhora] = useState(Date.now());
  const [version, setVersion] = useState(0);

  // Recalcula estados por fecha cada 30 s
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    guardarDatos(datos);
    setVersion((v) => v + 1);
  }, [datos]);
  useEffect(() => {
    guardarSesion(usuarioId);
  }, [usuarioId]);

  const usuario = datos.usuarios.find((u) => u.id === usuarioId) || null;

  const votaciones = useMemo(
    () => datos.votaciones.map((v) => ({ ...v, estado: calcularEstado(v, ahora) })),
    [datos.votaciones, ahora]
  );

  const misVotos = useMemo(
    () => (usuario ? datos.votos.filter((v) => v.usuarioId === usuario.id) : []),
    [datos.votos, usuario]
  );

  const registrarAuditoria = (d, accion, correo) => ({
    ...d,
    auditoria: [
      { id: siguienteId(d.auditoria), fechaHora: new Date().toISOString(), usuario: correo || usuario?.correo || 'sistema', accion },
      ...d.auditoria,
    ].slice(0, 200),
  });

  const actualizar = (fn, accion) => setDatos((d) => (accion ? registrarAuditoria(fn(d), accion) : fn(d)));

  // ---------- Autenticación ----------
  const iniciarSesion = async (correo, contrasena) => {
    const u = datos.usuarios.find((x) => x.correo.toLowerCase() === correo.trim().toLowerCase());
    if (!u || u.contrasena !== contrasena) return { ok: false, error: 'Correo o contraseña incorrectos.' };
    setUsuarioId(u.id);
    setDatos((d) => registrarAuditoria(d, 'Inició sesión', u.correo));
    return { ok: true, usuario: u };
  };

  const cerrarSesion = async () => {
    setUsuarioId(null);
    return { ok: true };
  };

  const registrarUsuario = async (form) => {
    if (datos.usuarios.some((u) => u.correo.toLowerCase() === form.correo.trim().toLowerCase())) {
      return { ok: false, error: 'Ya existe una cuenta con este correo.', errores: { correo: 'Ya existe una cuenta con este correo.' } };
    }
    const nuevo = {
      id: siguienteId(datos.usuarios),
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      correo: form.correo.trim().toLowerCase(),
      contrasena: form.contrasena, // solo en el modo demostración
      rol: 'votante',
      aceptaTratamientoDatos: form.aceptaTratamientoDatos,
      fechaRegistro: new Date().toISOString(),
    };
    setDatos((d) => registrarAuditoria({ ...d, usuarios: [...d.usuarios, nuevo] }, 'Se registró como votante', nuevo.correo));
    setUsuarioId(nuevo.id);
    return { ok: true, usuario: nuevo };
  };

  // ---------- Votación ----------
  const votosDeUsuario = useCallback((votacionId) => misVotos.filter((v) => v.votacionId === votacionId), [misVotos]);

  const anioDeVotacion = (votacion) => {
    const categoria = datos.categorias.find((c) => c.id === votacion.categoriaId);
    return datos.ediciones.find((e) => e.id === categoria?.edicionId)?.anio || new Date().getFullYear();
  };

  const emitirVoto = async (votacionId, opcionId) => {
    if (!usuario) return { ok: false, error: 'Debes iniciar sesión para votar.' };
    const votacion = votaciones.find((v) => v.id === votacionId);
    if (!votacion || votacion.estado !== 'abierta') return { ok: false, error: 'La votación no está abierta.' };
    if (votosDeUsuario(votacionId).length >= votacion.votosPorUsuario) return { ok: false, error: 'Ya registraste tu voto en esta votación.' };
    const voto = {
      id: siguienteId(datos.votos),
      usuarioId: usuario.id,
      votacionId,
      opcionId,
      fechaHora: new Date().toISOString(),
      codigoComprobante: generarCodigoComprobante(anioDeVotacion(votacion)),
    };
    actualizar((d) => ({ ...d, votos: [...d.votos, voto] }), `Emitió voto en "${votacion.titulo}" (comprobante ${voto.codigoComprobante})`);
    return { ok: true, voto };
  };

  // ---------- CRUD genérico para administración ----------
  const ambitoSlug = { categorias: 'edicionId', votaciones: 'categoriaId' };

  const guardarEntidad = async (coleccion, entidad, accion) => {
    const lista = datos[coleccion];
    const actual = entidad.id ? lista.find((x) => x.id === entidad.id) : null;
    const combinada = { ...actual, ...entidad };

    if (coleccion === 'votaciones' && combinada.publicada && !actual?.publicada) {
      const activas = datos.opciones.filter((o) => o.votacionId === entidad.id && o.activa !== false).length;
      if (!entidad.id || activas < 2) {
        return { ok: false, error: 'La votación necesita al menos dos opciones activas para publicarse.' };
      }
    }

    const campoAmbito = ambitoSlug[coleccion];
    let extra = {};
    if (campoAmbito) {
      const vecinos = lista.filter((x) => x[campoAmbito] === combinada[campoAmbito] && x.id !== entidad.id).map((x) => x.slug);
      if (combinada.slug && vecinos.includes(combinada.slug)) {
        const error = 'Ya existe otro elemento con este identificador de URL.';
        return { ok: false, error, errores: { slug: error } };
      }
      if (!combinada.slug) extra = { slug: slugUnico(combinada.titulo || combinada.nombre, vecinos) };
    }

    const guardada = actual ? { ...combinada, ...extra } : { ...entidad, ...extra, id: siguienteId(lista) };
    actualizar((d) => {
      const l = d[coleccion];
      if (actual) return { ...d, [coleccion]: l.map((x) => (x.id === guardada.id ? guardada : x)) };
      return { ...d, [coleccion]: [...l, guardada] };
    }, accion);
    return { ok: true, entidad: guardada };
  };

  const eliminarEntidad = async (coleccion, id, accion) => {
    if ((coleccion === 'votaciones' || coleccion === 'opciones') && datos.votos.some((v) => (coleccion === 'votaciones' ? v.votacionId : v.opcionId) === id)) {
      return { ok: false, error: 'No se puede eliminar porque ya tiene votos; ciérrala o desactívala.' };
    }
    const dependientes = { ediciones: ['categorias', 'edicionId'], categorias: ['votaciones', 'categoriaId'] }[coleccion];
    if (dependientes && datos[dependientes[0]].some((x) => x[dependientes[1]] === id)) {
      return { ok: false, error: 'No se puede eliminar porque tiene registros asociados; desactívalo.' };
    }
    actualizar((d) => {
      const nuevo = { ...d, [coleccion]: d[coleccion].filter((x) => x.id !== id) };
      if (coleccion === 'votaciones') nuevo.opciones = d.opciones.filter((o) => o.votacionId !== id);
      return nuevo;
    }, accion);
    return { ok: true };
  };

  const reemplazarColeccion = async (coleccion, lista, accion) => {
    actualizar((d) => ({ ...d, [coleccion]: lista }), accion);
    return { ok: true };
  };

  // ---------- Resultados y exportación ----------
  const obtenerResultados = useCallback(
    async (votacionId, { admin = false } = {}) => {
      const votacion = votaciones.find((v) => v.id === votacionId);
      if (!votacion) return { ok: false, status: 404, error: 'La votación no existe.' };
      if (!admin && !resultadosVisibles(votacion)) {
        return {
          ok: false,
          status: 403,
          error:
            votacion.mostrarResultados === 'no publicar'
              ? 'Los resultados de esta votación no se publican al público.'
              : 'Los resultados se publicarán al cierre de la votación.',
        };
      }
      const opcionesVotacion = datos.opciones.filter((o) => o.votacionId === votacionId);
      return { ok: true, ...calcularResultados(opcionesVotacion, datos.votos.filter((v) => v.votacionId === votacionId)) };
    },
    [votaciones, datos.opciones, datos.votos]
  );

  const exportarResultadosCSV = async (votacionId) => {
    const votacion = votaciones.find((v) => v.id === votacionId);
    const r = await obtenerResultados(votacionId, { admin: true });
    if (!votacion || !r.ok) return { ok: false, error: r.error || 'La votación no existe.' };
    const categoria = datos.categorias.find((c) => c.id === votacion.categoriaId);
    const edicion = datos.ediciones.find((e) => e.id === categoria?.edicionId);
    const filasCsv = [
      ['Edición', edicion?.nombre],
      ['Categoría', categoria?.nombre],
      ['Votación', votacion.titulo],
      ['Estado', votacion.estado],
      ['Generado', formatearFechaHora(new Date().toISOString())],
      [],
      ['Posición', 'Opción', 'Votos', 'Porcentaje'],
      ...r.filas.map((f, i) => [i + 1, f.nombre, f.cantidad, `${f.porcentaje.toFixed(2)} %`]),
      [],
      ['Total', '', r.total, '100 %'],
    ];
    const nombre = `resultados-${votacion.slug || votacion.id}.csv`;
    descargarCSV(nombre, filasCsv);
    actualizar((d) => d, `Exportó los resultados de "${votacion.titulo}"`);
    return { ok: true, nombre };
  };

  const cargarAuditoria = async (pagina = 1) => {
    const inicio = (pagina - 1) * POR_PAGINA_AUDITORIA;
    return {
      ok: true,
      registros: datos.auditoria.slice(inicio, inicio + POR_PAGINA_AUDITORIA),
      total: datos.auditoria.length,
      hayMas: inicio + POR_PAGINA_AUDITORIA < datos.auditoria.length,
    };
  };

  const restablecer = async () => {
    setDatos(restablecerDatos());
    setUsuarioId(null);
    return { ok: true };
  };

  const valor = {
    modo: 'mock',
    ...datos,
    votaciones,
    misVotos,
    totalVotos: datos.votos.length,
    usuario,
    esAdmin: usuario?.rol === 'administrador',
    edicionActiva: buscarEdicionActiva(datos.ediciones),
    version,
    iniciarSesion,
    cerrarSesion,
    registrarUsuario,
    votosDeUsuario,
    emitirVoto,
    guardarEntidad,
    eliminarEntidad,
    reemplazarColeccion,
    obtenerResultados,
    exportarResultadosCSV,
    cargarAuditoria,
    restablecer,
  };

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}
