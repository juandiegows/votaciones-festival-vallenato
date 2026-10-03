import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

// URL amigables (sin IDs):
//   /{año}                                   categorías de la edición
//   /{año}/categorias/{categoría}                       votaciones de la categoría
//   /{año}/categorias/{categoría}/{votación}            detalle y voto
//   /{año}/categorias/{categoría}/{votación}/comprobante
export const PATRON_ANIO = /^\d{4}$/;

/** Constructores de rutas a partir de los objetos del contexto. */
export function useRutas() {
  const { ediciones, categorias } = useApp();
  return useMemo(() => {
    const anioDe = (edicionId) => ediciones.find((e) => e.id === edicionId)?.anio;
    const categoria = (c) => `/${anioDe(c.edicionId)}/categorias/${c.slug}`;
    const votacion = (v) => {
      const c = categorias.find((x) => x.id === v.categoriaId);
      if (c) return `${categoria(c)}/${v.slug}`;
      return v.edicionAnio && v.categoriaSlug ? `/${v.edicionAnio}/categorias/${v.categoriaSlug}/${v.slug}` : '/';
    };
    return {
      edicion: (e) => `/${e.anio}`,
      categoria,
      votacion,
      comprobante: (v) => `${votacion(v)}/comprobante`,
      /** Ruta del comprobante desde un voto (usa los datos de ruta que trae el voto si la votación no está cargada). */
      comprobanteDeVoto: (voto, v) =>
        v ? `${votacion(v)}/comprobante` : voto.edicionAnio ? `/${voto.edicionAnio}/categorias/${voto.categoriaSlug}/${voto.votacionSlug}/comprobante` : '/mis-votos',
    };
  }, [ediciones, categorias]);
}

/** Resuelve los parámetros de la URL pública a la edición, categoría y votación correspondientes. */
export function useRutaPublica() {
  const { anio, categoriaSlug, votacionSlug } = useParams();
  const { ediciones, categorias, votaciones } = useApp();
  const edicion = PATRON_ANIO.test(anio || '') ? ediciones.find((e) => String(e.anio) === anio) || null : null;
  const categoria = edicion && categoriaSlug ? categorias.find((c) => c.edicionId === edicion.id && c.slug === categoriaSlug) || null : null;
  const votacion = categoria && votacionSlug ? votaciones.find((v) => v.categoriaId === categoria.id && v.slug === votacionSlug) || null : null;
  return { edicion, categoria, votacion };
}
