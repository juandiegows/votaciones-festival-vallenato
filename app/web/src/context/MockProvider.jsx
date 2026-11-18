import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLAVE_DATOS, cargarDatos, cargarSesion, completarDatos, guardarDatos, guardarSesion, restablecerDatos } from '../data/storage.js';
import {
  calcularEstado,
  calcularResultados,
  formatearFechaHora,
  generarCodigoComprobante,
  resultadosVisibles,
  calcularVisibilidad,
  calcularVotos,
  votosPermitidos,
  siguienteId,
  slugUnico,
  slugificar,
} from '../utils/helpers.js';
import { calcularParticipacion, calcularResumen, verificarIntegridad } from '../utils/analisis.js';
import { AppContext, buscarEdicionActiva, crearPuede } from './contexto.js';
import { ADMINISTRADOR, DESCRIPCION_PERMISO, GRUPOS_PERMISOS, ROLES_FIJOS, permisosEfectivos } from '../data/permisos.js';
import { descargarReporte } from '../utils/exportar.js';
import { normalizarDocumento } from '../utils/documento.js';
import { filtrarRegistros, registrosDemo, resumirRegistros } from '../data/registrosDemo.js';

// Archivos que el modo demostración guarda como data URL en este navegador
const ARCHIVOS = {
  banners: { campo: 'archivo', web: 'imagen' },
  revistas: { campo: 'archivoPdf', web: 'archivo' },
  categorias: { campo: 'archivoIcono', web: 'iconoImagen', quitar: 'quitarIcono' },
  votaciones: { campo: 'archivoIcono', web: 'iconoImagen', quitar: 'quitarIcono' },
  opciones: [
    { campo: 'archivoAudio', web: 'audio', quitar: 'quitarAudio' },
    { campo: 'archivoFoto', web: 'foto', quitar: 'quitarFoto' },
  ],
};

const leerComoDataUrl = (archivo) =>
  new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsDataURL(archivo);
  });

const POR_PAGINA_AUDITORIA = 50;
const iguales = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const PATRON_CODIGO_ROL = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
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
          setDatos(completarDatos(JSON.parse(e.newValue)));
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

  // Roles con sus permisos efectivos; cada usuario recibe el nombre de su rol y sus permisos (como /auth/yo/)
  const roles = useMemo(
    () => [...(datos.roles || [])]
      .map((r) => ({ ...r, permisos: permisosEfectivos(r), fijo: ROLES_FIJOS.includes(r.codigo), usuarios: datos.usuarios.filter((u) => u.rol === r.codigo).length }))
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')),
    [datos.roles, datos.usuarios]
  );
  const rolDe = useCallback((codigo) => roles.find((r) => r.codigo === codigo), [roles]);
  const usuarios = useMemo(
    () => datos.usuarios.map((u) => {
      const rol = rolDe(u.rol);
      return { ...u, rolNombre: rol?.nombre || u.rol, permisos: u.activo === false ? [] : rol?.permisos || [] };
    }),
    [datos.usuarios, rolDe]
  );
  const usuario = usuarios.find((u) => u.id === usuarioId) || null;
  const permisos = usuario?.permisos || [];
  const puede = crearPuede(permisos);

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
    return { ok: true, usuario: usuarios.find((x) => x.id === u.id) };
  };

  const cerrarSesion = async () => {
    setUsuarioId(null);
    return { ok: true };
  };

  const registrarUsuario = async (form) => {
    if (datos.usuarios.some((u) => u.correo.toLowerCase() === form.correo.trim().toLowerCase())) {
      return { ok: false, error: 'Ya existe una cuenta con este correo.', errores: { correo: 'Ya existe una cuenta con este correo.' } };
    }
    const numeroDocumento = normalizarDocumento(form.numeroDocumento || '') || null;
    if (numeroDocumento && datos.usuarios.some((u) => u.tipoDocumento === form.tipoDocumento && u.numeroDocumento === numeroDocumento)) {
      const error = 'Ya existe una cuenta con este documento.';
      return { ok: false, error, errores: { numeroDocumento: error } };
    }
    const nuevo = {
      id: siguienteId(datos.usuarios),
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      correo: form.correo.trim().toLowerCase(),
      tipoDocumento: numeroDocumento ? form.tipoDocumento : '',
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
    if (datos.configuracion?.pedirDocumento && !usuario.numeroDocumento) {
      return { ok: false, codigo: 'documento_requerido', error: 'Completa tu tipo y número de documento para poder votar.' };
    }
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
    const confs = [ARCHIVOS[coleccion] || []].flat();
    const entidad = { ...entidadOriginal };
    for (const conf of confs) {
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

  // ---------- Roles y permisos (mismas reglas que app/api/votaciones/cuentas/servicios.py) ----------
  const sinPermiso = (codigo) => ({ ok: false, codigo: 'permiso', error: `Tu rol no tiene el permiso «${DESCRIPCION_PERMISO[codigo]}».` });
  // Nadie reparte permisos que no tiene: evita que un rol delegado se dé más acceso del que posee
  const faltantes = (lista) => [...new Set(lista)].filter((c) => !permisos.includes(c)).sort();
  const errorFaltan = (accion, faltan) => ({
    ok: false, codigo: 'permisos_insuficientes', error: `No puedes ${accion}: incluye permisos que tu rol no tiene (${faltan.join(', ')}).`,
  });

  const cambiarRol = async (id, codigo) => {
    if (!puede('usuarios.cambiar_rol')) return sinPermiso('usuarios.cambiar_rol');
    const objetivo = usuarios.find((u) => u.id === id);
    if (!objetivo) return { ok: false, error: 'El usuario no existe.' };
    const nuevo = rolDe(codigo);
    if (!nuevo) return { ok: false, error: 'El rol no existe.' };
    if (objetivo.rol === codigo) return { ok: true, usuario: objetivo };
    if (id === usuarioId) return { ok: false, error: 'No puedes cambiar tu propio rol: pídeselo a otro administrador.' };
    let faltan = faltantes(nuevo.permisos);
    if (faltan.length) return errorFaltan(`asignar el rol «${nuevo.nombre}»`, faltan);
    const actual = rolDe(objetivo.rol);
    faltan = actual ? faltantes(actual.permisos) : [];
    if (faltan.length) return errorFaltan(`quitar el rol «${actual.nombre}»`, faltan);
    if (objetivo.rol === ADMINISTRADOR && !usuarios.some((u) => u.id !== id && u.rol === ADMINISTRADOR && u.activo !== false)) {
      return { ok: false, error: 'Debe quedar al menos un administrador activo.' };
    }
    if (objetivo.activo === false && nuevo.permisos.includes('panel.ver')) {
      return { ok: false, error: 'La cuenta está desactivada: actívala antes de darle acceso al panel.' };
    }
    actualizar((d) => ({ ...d, usuarios: d.usuarios.map((u) => (u.id === id ? { ...u, rol: codigo } : u)) }), `Cambió el rol de "${objetivo.correo}" a «${nuevo.nombre}»`);
    return { ok: true, usuario: { ...objetivo, rol: codigo, rolNombre: nuevo.nombre } };
  };

  // Crea un rol o cambia su nombre, descripción y permisos. Votante y administrador no cambian de permisos.
  const guardarRol = async (datosRol) => {
    if (!puede('roles.gestionar')) return sinPermiso('roles.gestionar');
    const nombre = (datosRol.nombre || '').trim();
    const errores = {};
    if (nombre.length < 3) errores.nombre = 'Escribe un nombre de al menos 3 caracteres.';
    const pedidos = [...new Set(datosRol.permisos || [])].filter((c) => DESCRIPCION_PERMISO[c]).sort();
    const actual = datosRol.id ? roles.find((r) => r.id === datosRol.id) : null;
    if (datosRol.id && !actual) return { ok: false, error: 'El rol no existe.' };
    let codigo = actual?.codigo;
    if (!actual) {
      codigo = (datosRol.codigo || slugificar(nombre)).trim().slice(0, 30);
      if (!PATRON_CODIGO_ROL.test(codigo)) errores.codigo = 'Usa solo minúsculas sin tildes, números, guiones o guion bajo.';
      else if (roles.some((r) => r.codigo === codigo)) errores.codigo = 'Ya existe un rol con este código.';
    }
    if (Object.keys(errores).length) return { ok: false, error: Object.values(errores).join(' '), errores };
    if (actual) {
      if (actual.codigo === usuario?.rol) return { ok: false, error: 'No puedes editar tu propio rol: pídeselo a otro administrador.' };
      if (actual.fijo && !iguales(pedidos, actual.permisos)) return { ok: false, codigo: 'rol_fijo', error: `Los permisos del rol «${actual.nombre}» son fijos.` };
      // Solo se exigen los permisos que cambian (los que ya estaban no los reparte quien edita)
      const cambian = [...pedidos.filter((c) => !actual.permisos.includes(c)), ...actual.permisos.filter((c) => !pedidos.includes(c))];
      const faltan = faltantes(cambian);
      if (faltan.length) return errorFaltan(`cambiar los permisos de «${actual.nombre}»`, faltan);
    } else {
      const faltan = faltantes(pedidos);
      if (faltan.length) return errorFaltan('crear este rol', faltan);
    }
    const guardado = {
      ...(actual ? datos.roles.find((r) => r.id === actual.id) : { id: siguienteId(datos.roles || []), codigo, sistema: false, orden: roles.length + 1 }),
      nombre,
      descripcion: (datosRol.descripcion || '').trim(),
    };
    if (!ROLES_FIJOS.includes(codigo)) guardado.permisos = pedidos;
    actualizar(
      (d) => ({ ...d, roles: actual ? d.roles.map((r) => (r.id === guardado.id ? guardado : r)) : [...d.roles, guardado] }),
      `${actual ? 'Actualizó' : 'Creó'} el rol «${nombre}» (${pedidos.length} permisos)`,
    );
    return { ok: true, rol: { ...guardado, permisos: permisosEfectivos(guardado) } };
  };

  const eliminarRol = async (id) => {
    if (!puede('roles.gestionar')) return sinPermiso('roles.gestionar');
    const rol = roles.find((r) => r.id === id);
    if (!rol) return { ok: false, error: 'El rol no existe.' };
    if (rol.sistema) return { ok: false, codigo: 'rol_sistema', error: `«${rol.nombre}» es un rol del sistema: no se elimina.` };
    const faltan = faltantes(rol.permisos);
    if (faltan.length) return errorFaltan(`eliminar el rol «${rol.nombre}»`, faltan);
    if (rol.usuarios) {
      return { ok: false, codigo: 'rol_con_usuarios', error: `«${rol.nombre}» tiene ${rol.usuarios} usuario(s): asígnales otro rol antes de eliminarlo.` };
    }
    actualizar((d) => ({ ...d, roles: d.roles.filter((r) => r.id !== id) }), `Eliminó el rol «${rol.nombre}»`);
    return { ok: true };
  };

  // Resultados de una votación, una categoría o una edición en pdf | excel | csv | json | sql (generados en el navegador)
  const exportar = async (coleccion, id, formato = 'pdf') => {
    const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    let lista = [];
    let titulo = '';
    let contexto = [];
    let nombreBase = '';
    if (coleccion === 'votaciones') {
      const v = votaciones.find((x) => x.id === id);
      if (!v) return { ok: false, error: 'La votación no existe.' };
      const c = datos.categorias.find((x) => x.id === v.categoriaId);
      lista = [v];
      titulo = 'Resultados de la votación';
      contexto = [['Edición', datos.ediciones.find((e) => e.id === c?.edicionId)?.nombre || ''], ['Categoría', c?.nombre || ''], ['Votación', v.titulo]];
      nombreBase = `resultados-${v.slug || v.id}`;
    } else if (coleccion === 'categorias') {
      const c = datos.categorias.find((x) => x.id === id);
      if (!c) return { ok: false, error: 'La categoría no existe.' };
      lista = votaciones.filter((v) => v.categoriaId === id);
      titulo = 'Resultados de la categoría';
      contexto = [['Edición', datos.ediciones.find((e) => e.id === c.edicionId)?.nombre || ''], ['Categoría', c.nombre]];
      nombreBase = `resultados-categoria-${c.slug || c.id}`;
    } else {
      const e = datos.ediciones.find((x) => x.id === id);
      if (!e) return { ok: false, error: 'La edición no existe.' };
      const ids = new Set(datos.categorias.filter((c) => c.edicionId === id).map((c) => c.id));
      lista = votaciones.filter((v) => ids.has(v.categoriaId));
      titulo = 'Resultados de la edición';
      contexto = [['Edición', e.nombre]];
      nombreBase = `resultados-edicion-${e.anio}`;
    }
    const secciones = [];
    for (const v of lista) {
      const r = await obtenerResultados(v.id, { admin: true });
      const c = datos.categorias.find((x) => x.id === v.categoriaId);
      secciones.push({
        edicion: datos.ediciones.find((e) => e.id === c?.edicionId)?.nombre || '', categoria: c?.nombre || '', votacion: v.titulo,
        estado: capital(v.estado), total: r.ok ? r.total : 0, filas: r.ok ? r.filas : [],
      });
    }
    const reporte = {
      titulo, nombreBase, secciones,
      contexto: [...contexto, ['Votaciones', secciones.length], ['Total de votos', secciones.reduce((s, x) => s + x.total, 0)], ['Generado', formatearFechaHora(new Date().toISOString())]],
    };
    const r = descargarReporte(reporte, formato);
    if (r.ok) actualizar((d) => d, `Exportó los resultados (${formato.toUpperCase()}) de "${contexto[contexto.length - 1][1]}"`);
    return r;
  };
  const exportarResultados = (votacionId, formato) => exportar('votaciones', votacionId, formato);
  // La plantilla de Excel y la importación de ediciones las procesa el servidor
  const sinApi = async () => ({ ok: false, error: 'Disponible cuando la web está conectada a la API (servidor). En el modo demostración no se procesan plantillas de Excel.' });

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

  // Logo del sitio: en la demostración se guarda como data URL (se valida igual que en la API: PNG, JPG o WebP de 1 MB)
  const guardarLogo = async (archivo, textoAlternativo = '') => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivo?.type)) {
      return { ok: false, error: 'Formato no permitido: usa una imagen JPG, PNG o WebP.' };
    }
    if (archivo.size > 1024 * 1024) return { ok: false, error: 'El logo supera el tamaño máximo de 1 MB.' };
    const logo = await new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result);
      lector.onerror = rechazar;
      lector.readAsDataURL(archivo);
    }).catch(() => null);
    if (!logo) return { ok: false, error: 'No se pudo leer la imagen.' };
    actualizar((d) => ({ ...d, configuracion: { ...d.configuracion, logo, logoTextoAlternativo: textoAlternativo } }), 'Cambió el logo del sitio');
    return { ok: true };
  };
  const quitarLogo = async () => {
    actualizar((d) => ({ ...d, configuracion: { ...d.configuracion, logo: '' } }), 'Quitó el logo del sitio (volvió el logo por defecto)');
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
    usuarios,
    roles,
    catalogoPermisos: GRUPOS_PERMISOS,
    votaciones,
    misVotos,
    totalVotos: datos.configuracion?.mostrarTotalVotos
      ? datos.votos.filter((v) => edicionDeVotacion(v.votacionId)?.estado === 'activa').length
      : null,
    publicarResultadosEdicion,
    usuario,
    permisos,
    puede,
    // «Accede al panel»: cualquier rol con panel.ver (no solo el administrador)
    esAdmin: puede('panel.ver'),
    edicionActiva: buscarEdicionActiva(datos.ediciones),
    version,
    iniciarSesion,
    cerrarSesion,
    registrarUsuario,
    // Sin correos en la demostración: confirmar y reenviar no tienen nada que hacer
    confirmarCorreo: async () => ({ ok: true, usuario }),
    reenviarConfirmacion: async () => ({ ok: true, mensaje: 'En la demostración la cuenta ya está confirmada.' }),
    completarDocumento: async (tipoDocumento, numero) => {
      if (!usuario) return { ok: false, error: 'Debes iniciar sesión.' };
      if (usuario.numeroDocumento) return { ok: false, codigo: 'documento_ya_registrado', error: 'Tu documento ya está registrado.' };
      const numeroDocumento = normalizarDocumento(numero);
      if (datos.usuarios.some((u) => u.tipoDocumento === tipoDocumento && u.numeroDocumento === numeroDocumento)) {
        const error = 'Ya existe una cuenta con este documento.';
        return { ok: false, error, errores: { numeroDocumento: error } };
      }
      setDatos((d) => ({ ...d, usuarios: d.usuarios.map((u) => (u.id === usuario.id ? { ...u, tipoDocumento, numeroDocumento } : u)) }));
      return { ok: true };
    },
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
    cambiarRol,
    guardarRol,
    eliminarRol,
    descargarPlantillaEdicion: sinApi,
    exportarEstructuraEdicion: sinApi,
    importarEdicion: sinApi,
    cargarAuditoria,
    obtenerParticipacion,
    obtenerResumen,
    obtenerIntegridad,
    // La autoría sale de las columnas de soporte de la base de datos: no existe en los datos simulados
    obtenerAutoria: async () => ({ ok: false, sinDatos: true, error: 'La autoría de los registros se consulta en la base de datos: conecta la web a la API.' }),
    // Registros técnicos: sin servidor no hay errores reales; se muestran unos pocos de ejemplo (ilustrativos)
    cargarRegistros: async (pagina = 1, filtros = {}) => {
      const lista = filtrarRegistros(registrosDemo(), filtros);
      const inicio = (pagina - 1) * POR_PAGINA_AUDITORIA;
      return { ok: true, ilustrativos: true, registros: lista.slice(inicio, inicio + POR_PAGINA_AUDITORIA), total: lista.length, hayMas: inicio + POR_PAGINA_AUDITORIA < lista.length };
    },
    obtenerResumenRegistros: async () => ({ ok: true, ...resumirRegistros(registrosDemo()) }),
    provocarErrorPrueba: async () => ({ ok: false, error: 'El error de prueba lo provoca el servidor: disponible cuando la web está conectada a la API. En el modo demostración los registros son ejemplos ilustrativos.' }),
    recargar,
    restablecer,
  };

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}
