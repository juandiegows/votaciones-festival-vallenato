// Cálculos del modo demostración que replican los endpoints de la API:
// participación (quién votó), resumen por edición e integridad de los votos.

/** Mínimo de votantes para mostrar la lista mientras la votación sigue abierta (bloques de 10). */
export const UMBRAL_PARTICIPACION = 10;

const MOTIVO_OCULTA =
  'La lista se muestra al cierre o al llegar a 10 votantes, para que no se pueda deducir el voto de las primeras personas.';

const ordenAlfabetico = (a, b) => a.nombre.localeCompare(b.nombre, 'es');

/**
 * Quién votó, nunca por qué opción. Cerrada: todos. Abierta: solo bloques completos de 10 votantes
 * (por orden de llegada), mostrados en orden alfabético y sin hora, para que no se pueda relacionar
 * a una persona con un cambio en los resultados.
 */
export function calcularParticipacion(votacion, votos, usuarios) {
  const propios = votos.filter((v) => v.votacionId === votacion.id).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
  const primero = new Map();
  propios.forEach((v) => !primero.has(v.usuarioId) && primero.set(v.usuarioId, v.fechaHora));
  const llegada = [...primero.entries()];
  const total = llegada.length;
  const cerrada = votacion.estado === 'cerrada';
  const visibles = cerrada ? total : Math.floor(total / UMBRAL_PARTICIPACION) * UMBRAL_PARTICIPACION;
  const votantes = llegada
    .slice(0, visibles)
    .map(([usuarioId, fecha]) => {
      const u = usuarios.find((x) => x.id === usuarioId);
      return { id: usuarioId, nombre: u ? `${u.nombres} ${u.apellidos}` : `Usuario #${usuarioId}`, correo: u?.correo || '', fecha: fecha.slice(0, 10) };
    })
    .sort(ordenAlfabetico);
  return {
    votacionId: votacion.id,
    estado: votacion.estado,
    umbral: UMBRAL_PARTICIPACION,
    totalVotos: propios.length,
    totalVotantes: total,
    disponible: cerrada || visibles > 0,
    motivo: cerrada || visibles > 0 ? '' : MOTIVO_OCULTA,
    ocultos: total - visibles,
    votantes,
  };
}

/** Categorías › votaciones › opciones de una edición con sus conteos. */
export function calcularResumen(edicion, { categorias, votaciones, opciones, votos }) {
  const cats = categorias.filter((c) => c.edicionId === edicion.id).sort((a, b) => a.orden - b.orden);
  const resultado = cats.map((c) => {
    const vots = votaciones.filter((v) => v.categoriaId === c.id).sort((a, b) => a.id - b.id);
    const filas = vots.map((v) => {
      const propios = votos.filter((x) => x.votacionId === v.id);
      const total = propios.length;
      const ops = opciones
        .filter((o) => o.votacionId === v.id)
        .map((o) => {
          const n = propios.filter((x) => x.opcionId === o.id).length;
          return { id: o.id, nombre: o.nombre, votos: n, porcentaje: total ? Math.round((n * 10000) / total) / 100 : 0 };
        })
        .sort((a, b) => b.votos - a.votos);
      return { id: v.id, titulo: v.titulo, estado: v.publicada ? v.estado : 'borrador', publicada: v.publicada, totalVotos: total, opciones: ops };
    });
    return { id: c.id, nombre: c.nombre, icono: c.icono, iconoImagen: c.iconoImagen || '', totalVotos: filas.reduce((s, v) => s + v.totalVotos, 0), votaciones: filas };
  });
  return { edicionId: edicion.id, totalVotos: resultado.reduce((s, c) => s + c.totalVotos, 0), categorias: resultado };
}

/** Comprueba que los votos cuadren: sin repetidos, sin opciones ajenas, dentro del plazo y con comprobantes únicos. */
export function verificarIntegridad(edicion, { categorias, votaciones, opciones, votos }) {
  const cats = categorias.filter((c) => c.edicionId === edicion.id);
  const vots = votaciones.filter((v) => cats.some((c) => c.id === v.categoriaId));
  const codigos = new Map();
  votos.forEach((v) => codigos.set(v.codigoComprobante, (codigos.get(v.codigoComprobante) || 0) + 1));
  const filas = vots.map((v) => {
    const propios = votos.filter((x) => x.votacionId === v.id);
    const ops = opciones.filter((o) => o.votacionId === v.id);
    const idsOps = new Set(ops.map((o) => o.id));
    const inactivas = new Set(ops.filter((o) => o.activa === false).map((o) => o.id));
    const porUsuario = new Map();
    propios.forEach((x) => porUsuario.set(x.usuarioId, (porUsuario.get(x.usuarioId) || 0) + 1));
    const suma = ops.reduce((s, o) => s + propios.filter((x) => x.opcionId === o.id).length, 0);
    const apertura = new Date(v.fechaApertura).getTime();
    const cierre = new Date(v.fechaCierre).getTime();
    const fila = {
      id: v.id,
      titulo: v.titulo,
      categoria: cats.find((c) => c.id === v.categoriaId)?.nombre || '',
      estado: v.publicada ? v.estado : 'borrador',
      votosPorUsuario: v.votosPorUsuario,
      totalVotos: propios.length,
      sumaPorOpcion: suma,
      votantesUnicos: porUsuario.size,
      usuariosExcedidos: [...porUsuario.values()].filter((n) => n > v.votosPorUsuario).length,
      votosOpcionAjena: propios.filter((x) => !idsOps.has(x.opcionId)).length,
      votosInactivos: propios.filter((x) => inactivas.has(x.opcionId)).length,
      votosFueraDePlazo: propios.filter((x) => {
        const t = new Date(x.fechaHora).getTime();
        return t < apertura || t > cierre;
      }).length,
      comprobantesDuplicados: propios.filter((x) => codigos.get(x.codigoComprobante) > 1).length,
    };
    const alertas = [];
    if (fila.sumaPorOpcion !== fila.totalVotos) alertas.push(`La suma por opción (${fila.sumaPorOpcion}) no coincide con el total de votos (${fila.totalVotos}).`);
    if (fila.usuariosExcedidos) alertas.push(`${fila.usuariosExcedidos} usuario(s) superan el límite de ${v.votosPorUsuario} voto(s).`);
    if (fila.votosOpcionAjena) alertas.push(`${fila.votosOpcionAjena} voto(s) apuntan a opciones de otra votación.`);
    if (fila.votosInactivos) alertas.push(`${fila.votosInactivos} voto(s) en opciones desactivadas.`);
    if (fila.votosFueraDePlazo) alertas.push(`${fila.votosFueraDePlazo} voto(s) fuera del horario de la votación.`);
    if (fila.comprobantesDuplicados) alertas.push(`${fila.comprobantesDuplicados} voto(s) con comprobante repetido.`);
    return { ...fila, ok: alertas.length === 0, alertas };
  });
  const votosEdicion = votos.filter((x) => vots.some((v) => v.id === x.votacionId));
  return {
    edicionId: edicion.id,
    generado: new Date().toISOString(),
    ok: filas.every((f) => f.ok),
    resumen: {
      totalVotos: votosEdicion.length,
      votantesUnicos: new Set(votosEdicion.map((x) => x.usuarioId)).size,
      votaciones: filas.length,
      conAlertas: filas.filter((f) => !f.ok).length,
    },
    votaciones: filas,
  };
}
