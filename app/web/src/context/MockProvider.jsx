import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLAVE_DATOS, cargarDatos, cargarSesion, guardarDatos, guardarSesion, restablecerDatos } from '../data/storage.js';
import {
  calcularEstado,
  calcularResultados,
  descargarCSV,
  formatearFechaHora,
  generarCodigoComprobante,
  resultadosVisibles,
  calcularVisibilidad,
  calcularVotos,
  votosPermitidos,
  siguienteId,
  slugUnico,
} from '../utils/helpers.js';
import { calcularParticipacion, calcularResumen, verificarIntegridad } from '../utils/analisis.js';
import { AppContext, buscarEdicionActiva } from './contexto.js';
import { normalizarDocumento } from '../utils/documento.js';

// Archivos que el modo demostración guarda como data URL en este navegador
const ARCHIVOS = {
  banners: { campo: 'archivo', web: 'imagen' },
  revistas: { campo: 'archivoPdf', web: 'archivo' },
  categorias: { campo: 'archivoIcono', web: 'iconoImagen', quitar: 'quitarIcono' },
  votaciones: { campo: 'archivoIcono', web: 'iconoImagen', quitar: 'quitarIcono' },
  opciones: { campo: 'archivoAudio', web: 'audio', quitar: 'quitarAudio' },
};

const leerComoDataUrl = (archivo) =>
  new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(archivo);
  });

const POR_PAGINA_AUDITORIA = 50;
const MAX_ARCHIVO_DEMO = 2 * 1024 * 1024;

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

  // Tiempo real entre pestañas: un voto emitido en otra pestaña actualiza el panel de inmediato
  useEffect(() => {
    const alCambiar = (e) => {
      if (e.key === CLAVE_DATOS && e.newValue) {
        try {
          setDatos(JSON.parse(e.newValue));
        } catch {
          /* ignorar datos corruptos */
        }
      }
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);
  useEffect(() => {
    guardarSesion(usuarioId);
  }, [usuarioId]);

  const usuario = datos.usuarios.find((u) => u.id === usuarioId) || null;

  const votaciones = useMemo(() => {
    const edicionDe = (v) => datos.ediciones.find((e) => e.id === datos.categorias.find((c) => c.id === v.categoriaId)?.edicionId);
    return datos.votaciones.map((v) => {
      const edicion = edicionDe(v);
      return {
        ...v,
        estado: calcularEstado(v, ahora),
        resultadosEfectivos: calcularVisibilidad(v, edicion),
        votosEfectivos: calcularVotos(v, edicion),
        pausada: !!edicion?.votacionesPausadas,
      };
    });
  }, [datos.votaciones, datos.categorias, datos.ediciones, ahora]);

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
    const numeroDocumento = normalizarDocumento(form.numeroDocumento);
    if (datos.usuarios.some((u) => u.tipoDocumento === form.tipoDocumento && u.numeroDocumento === numeroDocumento)) {
      const error = 'Ya existe una cuenta con este documento.';
      return { ok: false, error, errores: { numeroDocumento: error } };
    }
    const nuevo = {
      id: siguienteId(datos.usuarios),
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      correo: form.correo.trim().toLowerCase(),
      tipoDocumento: form.tipoDocumento,
      numeroDocumento,
      // En la demostración no se envían correos: la cuenta queda confirmada al crearla
      correoVerificado: true,
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
    if (votacion.pausada) return { ok: false, error: 'Las votaciones están en pausa temporalmente. Intenta más tarde.' };
    if (votosDeUsuario(votacionId).length >= votosPermitidos(votacion)) return { ok: false, error: 'Ya registraste tu voto en esta votación.' };
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

  const guardarEntidad = async (coleccion, entidadOriginal, accion) => {
    if (coleccion === 'categorias') {
      const destino = datos.ediciones.find((e) => e.id === Number(entidadOriginal.edicionId));
      const anterior = datos.categorias.find((c) => c.id === entidadOriginal.id);
      if (destino?.estado === 'cerrada' && anterior?.edicionId !== destino.id) {
        return { ok: false, error: 'La edición está cerrada: no se pueden agregar categorías.' };
      }
    }
    if (coleccion === 'opciones' && !entidadOriginal.id && votaciones.find((v) => v.id === entidadOriginal.votacionId)?.estado === 'cerrada') {
      return { ok: false, error: 'La votación está cerrada: no se pueden agregar opciones.' };
    }
    // Imagen, ícono o audio subido: en el modo demostración se guarda como data URL en este navegador
    const conf = ARCHIVOS[coleccion];
    const entidad = { ...entidadOriginal };
    if (conf) {
      const fichero = entidad[conf.campo];
      delete entidad[conf.campo];
      if (conf.quitar && entidad[conf.quitar]) entidad[conf.web] = '';
      delete entidad[conf.quitar];
      if (fichero && fichero.size > MAX_ARCHIVO_DEMO) {
        return { ok: false, error: 'En el modo demostración los archivos se guardan en este navegador: usa uno de máximo 2 MB.' };
      }
      if (fichero) {
        try {
          entidad[conf.web] = await leerComoDataUrl(fichero);
        } catch {
          return { ok: false, error: 'No fue posible leer el archivo seleccionado.' };
        }
      }
    }
    const lista = datos[coleccion];
    const actual = entidad.id ? lista.find((x) => x.id === entidad.id) : null;
    const combinada = { ...actual, ...entidad };

    if (coleccion === 'votaciones' && actual?.publicada && entidad.publicada === false) {
      const estado = votaciones.find((v) => v.id === actual.id)?.estado;
      if (estado === 'abierta') {
        return { ok: false, error: 'No se puede despublicar una votación abierta: espera al cierre o ciérrala primero.' };
      }
    }

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

  const edicionDeVotacion = (votacionId) => {
    const v = datos.votaciones.find((x) => x.id === votacionId);
    const c = datos.categorias.find((x) => x.id === v?.categoriaId);
    return datos.ediciones.find((e) => e.id === c?.edicionId);
  };

  // Publica u oculta los resultados de todas las votaciones de una edición
  const publicarResultadosEdicion = async (edicionId, publicar) => {
    const categoriasEd = new Set(datos.categorias.filter((c) => c.edicionId === edicionId).map((c) => c.id));
    const actualizadas = datos.votaciones.filter((v) => categoriasEd.has(v.categoriaId)).length;
    actualizar(
      (d) => ({ ...d, votaciones: d.votaciones.map((v) => (categoriasEd.has(v.categoriaId) ? { ...v, resultadosPublicados: publicar } : v)) }),
      `${publicar ? 'Publicó' : 'Retiró'} los resultados de todas las votaciones de la edición`,
    );
    return { ok: true, actualizadas };
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
            votacion.resultadosEfectivos === 'no publicar'
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

  const cargarAuditoria = async (pagina = 1, { q = '' } = {}) => {
    const texto = q.trim().toLowerCase();
    const lista = texto ? datos.auditoria.filter((a) => `${a.usuario} ${a.accion}`.toLowerCase().includes(texto)) : datos.auditoria;
    const inicio = (pagina - 1) * POR_PAGINA_AUDITORIA;
    return {
      ok: true,
      registros: lista.slice(inicio, inicio + POR_PAGINA_AUDITORIA),
      total: lista.length,
      hayMas: inicio + POR_PAGINA_AUDITORIA < lista.length,
    };
  };

  const obtenerParticipacion = useCallback(
    async (votacionId) => {
      const votacion = votaciones.find((v) => v.id === votacionId);
      if (!votacion) return { ok: false, error: 'La votación no existe.' };
      return { ok: true, ...calcularParticipacion(votacion, datos.votos, datos.usuarios) };
    },
    [votaciones, datos.votos, datos.usuarios]
  );

  const obtenerResumen = useCallback(
    async (edicionId) => {
      const edicion = datos.ediciones.find((e) => e.id === edicionId);
      if (!edicion) return { ok: false, error: 'La edición no existe.' };
      return { ok: true, ...calcularResumen(edicion, { ...datos, votaciones }) };
    },
    [datos, votaciones]
  );

  const obtenerIntegridad = useCallback(
    async (edicionId) => {
      const edicion = datos.ediciones.find((e) => e.id === edicionId);
      if (!edicion) return { ok: false, error: 'La edición no existe.' };
      return { ok: true, ...verificarIntegridad(edicion, { ...datos, votaciones }) };
    },
    [datos, votaciones]
  );

  // En este modo los datos ya están en memoria; se releen por si otra pestaña los cambió
  const recargar = useCallback(async () => {
    setDatos(cargarDatos());
    return { ok: true };
  }, []);

  const guardarConfiguracion = async (configuracion, accion = 'Actualizó los datos de contacto') => {
    actualizar((d) => ({ ...d, configuracion }), accion);
    return { ok: true };
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
    totalVotos: datos.configuracion?.mostrarTotalVotos
      ? datos.votos.filter((v) => edicionDeVotacion(v.votacionId)?.estado === 'activa').length
      : null,
    publicarResultadosEdicion,
    usuario,
    esAdmin: usuario?.rol === 'administrador',
    edicionActiva: buscarEdicionActiva(datos.ediciones),
    version,
    iniciarSesion,
    cerrarSesion,
    registrarUsuario,
    // Sin correos en la demostración: confirmar y reenviar no tienen nada que hacer
    confirmarCorreo: async () => ({ ok: true, usuario }),
    reenviarConfirmacion: async () => ({ ok: true, mensaje: 'En la demostración la cuenta ya está confirmada.' }),
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
    restablecer,
  };

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}
