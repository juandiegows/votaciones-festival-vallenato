// Utilidades compartidas del prototipo

/** Estado de una votación calculado a partir de sus fechas (o cierre manual). */
export function calcularEstado(votacion, ahora = Date.now()) {
  if (votacion.cerradaManualmente) return 'cerrada';
  const apertura = new Date(votacion.fechaApertura).getTime();
  const cierre = new Date(votacion.fechaCierre).getTime();
  if (ahora < apertura) return 'programada';
  if (ahora > cierre) return 'cerrada';
  return 'abierta';
}

export const ESTADOS = {
  abierta: { etiqueta: 'Abierta', clase: 'estado-abierta', icono: 'unlock-fill' },
  programada: { etiqueta: 'Programada', clase: 'estado-programada', icono: 'calendar-event' },
  cerrada: { etiqueta: 'Cerrada', clase: 'estado-cerrada', icono: 'lock-fill' },
};

export const OPCIONES_MOSTRAR_RESULTADOS = ['al cerrar', 'en tiempo real', 'no publicar'];

/** RN-07: ¿los resultados son visibles para el público? */
export function resultadosVisibles(votacion) {
  if (votacion.resultadosPublicados) return true;
  const visibilidad = visibilidadResultados(votacion);
  if (visibilidad === 'en tiempo real') return true;
  if (visibilidad === 'al cerrar') return votacion.estado === 'cerrada';
  return false;
}

/** Visibilidad que aplica a una votación: la de su edición, salvo que la votación la personalice. */
export const visibilidadResultados = (votacion) => votacion.resultadosEfectivos || votacion.mostrarResultados;

/** Calcula la visibilidad efectiva a partir de la edición (modo demostración). */
export const calcularVisibilidad = (votacion, edicion) =>
  votacion.personalizarResultados ? votacion.mostrarResultados : edicion?.mostrarResultados || 'al cerrar';

export const DESCRIPCION_RESULTADOS = {
  'en tiempo real': 'El público ve el conteo mientras la votación está abierta.',
  'al cerrar': 'El público ve los resultados cuando la votación cierra.',
  'no publicar': 'El público no ve los resultados (solo la administración).',
};

/** Código de comprobante FLV{aa}-XXXXXX, con los dos últimos dígitos del año de la edición (como la API). */
export function generarCodigoComprobante(anio) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
  return `FLV${String(Number(anio) % 100).padStart(2, '0')}-${codigo}`;
}

/** Slug para URL amigables: minúsculas, sin tildes, palabras separadas por guiones («Canción» → «cancion»). */
export function slugificar(texto) {
  return String(texto || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slug único dentro de `existentes` (agrega -2, -3… si se repite), igual que la API. */
export function slugUnico(texto, existentes) {
  const usados = new Set(existentes);
  const base = slugificar(texto) || 'item';
  let candidato = base;
  for (let n = 2; usados.has(candidato); n++) candidato = `${base}-${n}`;
  return candidato;
}

export const PATRON_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Enlace multimedia válido: URL http(s) absoluta o ruta del sitio que empieza por «/» (p. ej. /audio/muestras/x.mp3). */
export function validarEnlaceMultimedia(valor) {
  if (!valor) return true;
  return /^https?:\/\/\S+$/.test(valor) || /^\/(?!\/)\S*$/.test(valor);
}

const fmtFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtFechaHora = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function formatearFecha(valor) {
  if (!valor) return '—';
  const d = valor.length === 10 ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return fmtFecha.format(d);
}

export function formatearFechaHora(valor) {
  if (!valor) return '—';
  return fmtFechaHora.format(new Date(valor));
}

/** Convierte ISO → valor para <input type="datetime-local"> (hora local) */
export function isoALocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localAIso(valor) {
  return valor ? new Date(valor).toISOString() : '';
}

export function siguienteId(lista) {
  return lista.reduce((max, x) => Math.max(max, x.id), 0) + 1;
}

/** Calcula conteos y porcentajes por opción */
export function calcularResultados(opciones, votos) {
  const total = votos.length;
  const filas = opciones
    .map((o) => {
      const cantidad = votos.filter((v) => v.opcionId === o.id).length;
      return { ...o, cantidad, porcentaje: total ? (cantidad / total) * 100 : 0 };
    })
    .sort((a, b) => b.cantidad - a.cantidad || a.orden - b.orden);
  const max = filas.length ? filas[0].cantidad : 0;
  return { total, filas: filas.map((f) => ({ ...f, ganador: total > 0 && f.cantidad === max })) };
}

/** Descarga un CSV real generado en el navegador */
export function descargarCSV(nombreArchivo, filas) {
  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const contenido = filas.map((f) => f.map(escapar).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function validarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo);
}

/** Contraseña: mínimo 8 caracteres, una mayúscula, un número y un símbolo */
export function validarContrasena(c) {
  return c.length >= 8 && /[A-ZÁÉÍÓÚÑ]/.test(c) && /\d/.test(c) && /[^A-Za-z0-9]/.test(c);
}
