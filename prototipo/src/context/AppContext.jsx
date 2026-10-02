/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cargarDatos, cargarSesion, guardarDatos, guardarSesion, restablecerDatos } from '../data/storage.js';
import { calcularEstado, generarCodigoComprobante, siguienteId } from '../utils/helpers.js';

const AppContext = createContext(null);

/**
 * Contexto global: simula la capa de datos y autenticación.
 * Cada acción equivale a una futura vista/endpoint de Django.
 */
export function AppProvider({ children }) {
  const [datos, setDatos] = useState(cargarDatos);
  const [usuarioId, setUsuarioId] = useState(cargarSesion);
  const [ahora, setAhora] = useState(Date.now());

  // Recalcula estados por fecha cada 30 s
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    guardarDatos(datos);
  }, [datos]);
  useEffect(() => {
    guardarSesion(usuarioId);
  }, [usuarioId]);

  const usuario = datos.usuarios.find((u) => u.id === usuarioId) || null;

  const votaciones = useMemo(
    () => datos.votaciones.map((v) => ({ ...v, estado: calcularEstado(v, ahora) })),
    [datos.votaciones, ahora]
  );

  const registrarAuditoria = (d, accion, correo) => ({
    ...d,
    auditoria: [
      { id: siguienteId(d.auditoria), fechaHora: new Date().toISOString(), usuario: correo || usuario?.correo || 'sistema', accion },
      ...d.auditoria,
    ].slice(0, 200),
  });

  const actualizar = (fn, accion) => setDatos((d) => (accion ? registrarAuditoria(fn(d), accion) : fn(d)));

  // ---------- Autenticación (RF-01, RF-02) ----------
  const iniciarSesion = (correo, contrasena) => {
    const u = datos.usuarios.find((x) => x.correo.toLowerCase() === correo.trim().toLowerCase());
    if (!u || u.contrasena !== contrasena) return { ok: false, error: 'Correo o contraseña incorrectos.' };
    setUsuarioId(u.id);
    setDatos((d) => registrarAuditoria(d, 'Inició sesión', u.correo));
    return { ok: true, usuario: u };
  };

  const cerrarSesion = () => setUsuarioId(null);

  const registrarUsuario = (form) => {
    if (datos.usuarios.some((u) => u.correo.toLowerCase() === form.correo.trim().toLowerCase())) {
      return { ok: false, error: 'Ya existe una cuenta con este correo.' };
    }
    const nuevo = {
      id: siguienteId(datos.usuarios),
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      correo: form.correo.trim().toLowerCase(),
      contrasena: form.contrasena, // solo mock
      rol: 'votante',
      aceptaTratamientoDatos: form.aceptaTratamientoDatos,
      fechaRegistro: new Date().toISOString(),
    };
    setDatos((d) => registrarAuditoria({ ...d, usuarios: [...d.usuarios, nuevo] }, 'Se registró como votante', nuevo.correo));
    setUsuarioId(nuevo.id);
    return { ok: true };
  };

  // ---------- Votación (RF-07, RN-02..RN-05) ----------
  const votosDeUsuario = useCallback(
    (votacionId) => (usuario ? datos.votos.filter((v) => v.usuarioId === usuario.id && v.votacionId === votacionId) : []),
    [datos.votos, usuario]
  );

  const emitirVoto = (votacionId, opcionId) => {
    if (!usuario) return { ok: false, error: 'Debes iniciar sesión para votar (RN-02).' };
    const votacion = votaciones.find((v) => v.id === votacionId);
    if (!votacion || votacion.estado !== 'abierta') return { ok: false, error: 'La votación no está abierta (RN-03).' };
    if (votosDeUsuario(votacionId).length >= votacion.votosPorUsuario) return { ok: false, error: 'Ya registraste tu voto en esta votación (RN-04).' };
    const voto = {
      id: siguienteId(datos.votos),
      usuarioId: usuario.id,
      votacionId,
      opcionId,
      fechaHora: new Date().toISOString(),
      codigoComprobante: generarCodigoComprobante(),
    };
    actualizar((d) => ({ ...d, votos: [...d.votos, voto] }), `Emitió voto en "${votacion.titulo}" (comprobante ${voto.codigoComprobante})`);
    return { ok: true, voto };
  };

  // ---------- CRUD genérico para administración ----------
  const guardarEntidad = (coleccion, entidad, accion) => {
    const esNueva = !entidad.id;
    const guardada = esNueva ? { ...entidad, id: siguienteId(datos[coleccion]) } : entidad;
    actualizar((d) => {
      const lista = d[coleccion];
      if (!esNueva) return { ...d, [coleccion]: lista.map((x) => (x.id === entidad.id ? { ...x, ...entidad } : x)) };
      return { ...d, [coleccion]: [...lista, guardada] };
    }, accion);
    return guardada;
  };

  const eliminarEntidad = (coleccion, id, accion) =>
    actualizar((d) => ({ ...d, [coleccion]: d[coleccion].filter((x) => x.id !== id) }), accion);

  const reemplazarColeccion = (coleccion, lista, accion) => actualizar((d) => ({ ...d, [coleccion]: lista }), accion);

  const restablecer = () => {
    setDatos(restablecerDatos());
    setUsuarioId(null);
  };

  const valor = {
    ...datos,
    votaciones,
    usuario,
    esAdmin: usuario?.rol === 'administrador',
    edicionActiva: datos.ediciones.find((e) => e.estado === 'activa') || datos.ediciones[0],
    iniciarSesion,
    cerrarSesion,
    registrarUsuario,
    votosDeUsuario,
    emitirVoto,
    guardarEntidad,
    eliminarEntidad,
    reemplazarColeccion,
    restablecer,
  };

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
